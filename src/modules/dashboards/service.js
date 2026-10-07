const { prisma } = require("../../config/prisma");
const { raw } = require("../../generated/prisma/client");
const { Plot } = require("../properties/plot.model");
const { OPEN_STATUSES } = require("../complaints/complaint.config");

const CACHE_TTL_MS = 45_000;
const cache = new Map();

const OCCUPIED_STATUSES = [
  Plot.STATUS.ALLOTTED,
  Plot.STATUS.SOLD,
  Plot.STATUS.TRANSFERRED,
  Plot.STATUS.POSSESSED,
  Plot.STATUS.UNDER_CONSTRUCTION,
  Plot.STATUS.CONSTRUCTED,
];

const now = () => new Date();
const toNumber = (value) => (value === null || value === undefined ? 0 : Number(value));

const lastMonths = (count = 6) => {
  const current = now();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (count - 1 - index), 1));
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    };
  });
};

const lastDays = (count = 7) => {
  const current = now();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(current.getTime() - (count - 1 - index) * 86400000);
    return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) };
  });
};

const responseHeader = (type, extra = {}) => ({
  type,
  generatedAt: new Date().toISOString(),
  currency: "PKR",
  ...extra,
});

/** Map a raw SQL row to the legacy document shape (`_id`, ISO dates, numeric decimals). */
const toDoc = (row) => {
  if (!row) return null;
  const doc = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      doc[key] = null;
    } else if (value instanceof Date) {
      doc[key] = value.toISOString();
    } else if (typeof value === "object" && typeof value.toNumber === "function") {
      doc[key] = value.toNumber();
    } else if (typeof value === "bigint") {
      doc[key] = Number(value);
    } else {
      doc[key] = value;
    }
  }
  if (doc.id !== undefined && doc._id === undefined) doc._id = doc.id;
  return doc;
};

const toDocs = (rows) => (rows || []).map(toDoc);

const monthStartUtc = (monthsAgo = 5) => {
  const current = now();
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - monthsAgo, 1));
};

const dayStartUtc = (daysAgo = 6) => {
  const current = now();
  const d = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() - daysAgo));
  return d;
};

const sqlStringList = (values) => values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ");

class DashboardService {
  static async count(table, whereSql = "") {
    const rows = whereSql
      ? await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM ${raw(table)} WHERE ${raw(whereSql)}`
      : await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM ${raw(table)}`;
    return toNumber(rows[0]?.count);
  }

  static async sum(table, column, whereSql = "") {
    const rows = whereSql
      ? await prisma.$queryRaw`
          SELECT COALESCE(SUM(${raw(column)}), 0)::float8 AS total
          FROM ${raw(table)}
          WHERE ${raw(whereSql)}
        `
      : await prisma.$queryRaw`
          SELECT COALESCE(SUM(${raw(column)}), 0)::float8 AS total
          FROM ${raw(table)}
        `;
    return toNumber(rows[0]?.total);
  }

  static async groupByStatus(table, statusColumn = "status") {
    const rows = await prisma.$queryRaw`
      SELECT COALESCE(${raw(statusColumn)}, 'Unspecified') AS label,
             COUNT(*)::int AS count
      FROM ${raw(table)}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((r) => ({ label: r.label, count: toNumber(r.count) }));
  }

  static async financialTrend() {
    const months = lastMonths();
    const start = monthStartUtc(5);
    const [billed, collected, expenses] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "dueDate"), 'YYYY-MM') AS period,
               COALESCE(SUM(amount), 0)::float8 AS total
        FROM installments
        WHERE "dueDate" >= ${start}::timestamptz
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS period,
               COALESCE(SUM(amount), 0)::float8 AS total
        FROM payments
        WHERE status = 'Completed' AND "createdAt" >= ${start}::timestamptz
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS period,
               COALESCE(SUM(amount), 0)::float8 AS total
        FROM expenses
        WHERE status = 'Paid' AND date >= ${start}::timestamptz
        GROUP BY 1
      `,
    ]);
    const billedMap = new Map(billed.map((r) => [r.period, toNumber(r.total)]));
    const collectedMap = new Map(collected.map((r) => [r.period, toNumber(r.total)]));
    const expenseMap = new Map(expenses.map((r) => [r.period, toNumber(r.total)]));
    return months.map(({ key, label }) => ({
      month: label,
      period: key,
      billed: billedMap.get(key) || 0,
      collected: collectedMap.get(key) || 0,
      expenses: expenseMap.get(key) || 0,
    }));
  }

  static async lowStock() {
    const rows = await prisma.$queryRaw`
      SELECT *
      FROM inventory_items
      WHERE COALESCE(quantity, 0) <= COALESCE("reorderLevel", 0)
      ORDER BY (COALESCE("reorderLevel", 0) - COALESCE(quantity, 0)) DESC
    `;
    return toDocs(rows).map((item) => ({
      ...item,
      shortage: Math.max(0, Number(item.reorderLevel || 0) - Number(item.quantity || 0)),
    }));
  }

  static async recentPayments(limit = 6) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM payments
      ORDER BY "createdAt" DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `;
    return toDocs(rows);
  }

  static async openComplaintsList(limit = 6) {
    const statuses = sqlStringList(OPEN_STATUSES);
    const rows = await prisma.$queryRaw`
      SELECT * FROM complaints
      WHERE status IN (${raw(statuses)})
      ORDER BY "createdAt" DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `;
    return toDocs(rows);
  }

  static async management() {
    const monthPrefix = now().toISOString().slice(0, 7);
    const occupiedStatuses = sqlStringList(OCCUPIED_STATUSES);
    const openStatuses = sqlStringList(OPEN_STATUSES);

    const [
      members,
      activeMembers,
      plots,
      occupied,
      dues,
      openComplaints,
      employees,
      collection,
      financialTrend,
      plotStatus,
      complaintStatus,
      recentPayments,
      openComplaintsList,
      lowStock,
    ] = await Promise.all([
      this.count("members"),
      this.count("members", `status = 'Active'`),
      this.count("plots"),
      this.count("plots", `"currentOwner" IS NOT NULL AND status IN (${occupiedStatuses})`),
      this.sum("installments", "balance"),
      this.count("complaints", `status IN (${openStatuses})`),
      this.count("employees", `status IN ('Active', 'On Leave')`),
      this.sum("payments", "amount", `status = 'Completed' AND to_char(date_trunc('month', "createdAt"), 'YYYY-MM') = '${monthPrefix}'`),
      this.financialTrend(),
      this.groupByStatus("plots"),
      this.groupByStatus("complaints"),
      this.recentPayments(6),
      this.openComplaintsList(6),
      this.lowStock(),
    ]);

    return responseHeader("management", {
      stats: [
        { key: "members", label: "Total Members", value: members, format: "number" },
        { key: "activeMembers", label: "Active Members", value: activeMembers, format: "number" },
        { key: "plots", label: "Total Plots", value: plots, format: "number" },
        { key: "occupancy", label: "Occupancy Rate", value: plots ? Number(((occupied / plots) * 100).toFixed(1)) : 0, format: "percent" },
        { key: "dues", label: "Outstanding Dues", value: dues, format: "currency" },
        { key: "complaints", label: "Open Complaints", value: openComplaints, format: "number" },
        { key: "employees", label: "Active Employees", value: employees, format: "number" },
        { key: "collection", label: "Collected This Month", value: collection, format: "currency" },
      ],
      charts: {
        financialTrend,
        plotStatus,
        complaintStatus,
      },
      lists: {
        recentPayments,
        openComplaints: openComplaintsList,
      },
      lowStock,
    });
  }

  static async finance() {
    const monthPrefix = now().toISOString().slice(0, 7);
    const [
      collected,
      outstanding,
      overdue,
      expenses,
      payments,
      defaulterRows,
      defaulterCountRows,
      financialTrend,
      duesStatusRows,
      lowStock,
    ] = await Promise.all([
      this.sum("payments", "amount", `status = 'Completed' AND to_char(date_trunc('month', "createdAt"), 'YYYY-MM') = '${monthPrefix}'`),
      this.sum("installments", "balance"),
      this.sum("installments", "balance", `status = 'Overdue'`),
      this.sum("expenses", "amount", `status = 'Paid'`),
      this.count("payments", `status = 'Completed'`),
      prisma.$queryRaw`
        SELECT i.member AS "memberId",
               m.name AS "memberName",
               COALESCE(SUM(i.balance), 0)::float8 AS amount,
               COUNT(*)::int AS installments
        FROM installments i
        LEFT JOIN members m ON m.id = i.member
        WHERE i.balance > 0
        GROUP BY i.member, m.name
        ORDER BY amount DESC
        LIMIT 8
      `,
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT member)::int AS count
        FROM installments
        WHERE balance > 0
      `,
      this.financialTrend(),
      prisma.$queryRaw`
        SELECT COALESCE(status, 'Unspecified') AS label,
               COUNT(*)::int AS count
        FROM installments
        WHERE balance > 0
        GROUP BY 1
        ORDER BY 1
      `,
      this.lowStock(),
    ]);

    const dues = defaulterRows.map((r) => ({
      memberId: r.memberId,
      amount: toNumber(r.amount),
      installments: toNumber(r.installments),
      memberName: r.memberName || "Unknown",
    }));

    return responseHeader("finance", {
      stats: [
        { key: "collected", label: "Collected This Month", value: collected, format: "currency" },
        { key: "outstanding", label: "Outstanding Dues", value: outstanding, format: "currency" },
        { key: "overdue", label: "Overdue Dues", value: overdue, format: "currency" },
        { key: "expenses", label: "Paid Expenses", value: expenses, format: "currency" },
        { key: "payments", label: "Payment Count", value: payments, format: "number" },
        { key: "defaulters", label: "Defaulters", value: toNumber(defaulterCountRows[0]?.count), format: "number" },
      ],
      charts: {
        financialTrend,
        duesStatus: duesStatusRows.map((r) => ({ label: r.label, count: toNumber(r.count) })),
        defaulters: dues.map((item) => ({ label: item.memberName, amount: item.amount, value: item.amount })),
      },
      lists: { defaulters: dues },
      lowStock,
    });
  }

  static async operations() {
    const openStatuses = sqlStringList(OPEN_STATUSES);
    const months = lastMonths();
    const start = monthStartUtc(5);

    const [
      openComplaints,
      slaBreaches,
      workOrders,
      resolved,
      assets,
      staff,
      complaintTrendCreated,
      complaintTrendResolved,
      complaintStatus,
      workOrderStatus,
      openComplaintsList,
      openWorkOrders,
      lowStock,
    ] = await Promise.all([
      this.count("complaints", `status IN (${openStatuses})`),
      this.count("complaints", `status IN (${openStatuses}) AND "slaDueDate" IS NOT NULL AND "slaDueDate" < NOW()`),
      this.count("work_orders", `status IN ('Open', 'InProgress')`),
      this.count("complaints", `status IN ('Resolved', 'Closed')`),
      this.count("assets"),
      this.count("employees", `department IN ('Operations', 'Administration')`),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS period,
               COUNT(*)::int AS count
        FROM complaints
        WHERE "createdAt" >= ${start}::timestamptz
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "resolvedAt"), 'YYYY-MM') AS period,
               COUNT(*)::int AS count
        FROM complaints
        WHERE "resolvedAt" >= ${start}::timestamptz
        GROUP BY 1
      `,
      this.groupByStatus("complaints"),
      this.groupByStatus("work_orders"),
      this.openComplaintsList(8),
      prisma.$queryRaw`
        SELECT * FROM work_orders
        WHERE status IN ('Open', 'InProgress')
        ORDER BY "createdAt" DESC NULLS LAST, id DESC
        LIMIT 8
      `,
      this.lowStock(),
    ]);

    const createdMap = new Map(complaintTrendCreated.map((r) => [r.period, toNumber(r.count)]));
    const resolvedMap = new Map(complaintTrendResolved.map((r) => [r.period, toNumber(r.count)]));
    const complaintTrend = months.map(({ key, label }) => ({
      month: label,
      period: key,
      created: createdMap.get(key) || 0,
      resolved: resolvedMap.get(key) || 0,
    }));

    return responseHeader("operations", {
      stats: [
        { key: "openComplaints", label: "Open Complaints", value: openComplaints, format: "number" },
        { key: "overdue", label: "SLA Breaches", value: slaBreaches, format: "number" },
        { key: "workOrders", label: "Open Work Orders", value: workOrders, format: "number" },
        { key: "resolved", label: "Resolved Complaints", value: resolved, format: "number" },
        { key: "assets", label: "Registered Assets", value: assets, format: "number" },
        { key: "staff", label: "Operations Staff", value: staff, format: "number" },
      ],
      charts: {
        complaintTrend,
        complaintStatus,
        workOrderStatus,
      },
      lists: {
        openComplaints: openComplaintsList,
        workOrders: toDocs(openWorkOrders),
      },
      lowStock,
    });
  }

  static async security() {
    const days = lastDays();
    const start = dayStartUtc(6);
    const today = now().toISOString().slice(0, 10);

    const [
      visitorsToday,
      activeVisitors,
      vehicles,
      blockedVehicles,
      guards,
      passes,
      visitorTrendRows,
      gateBreakdown,
      vehicleTypes,
      recentVisitors,
      expiringPasses,
    ] = await Promise.all([
      this.count("visitor_entries", `to_char(date_trunc('day', "entryTime"), 'YYYY-MM-DD') = '${today}'`),
      this.count("visitor_entries", `"exitTime" IS NULL`),
      this.count("vehicles"),
      this.count("vehicles", `status = 'Blocked'`),
      this.count("guards", `status = 'Active'`),
      this.count("passes", `status = 'Active'`),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('day', "entryTime"), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS entries,
               COUNT(*) FILTER (WHERE "exitTime" IS NULL)::int AS active
        FROM visitor_entries
        WHERE "entryTime" >= ${start}::timestamptz
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT COALESCE(gate, 'Unspecified') AS label,
               COUNT(*)::int AS count
        FROM visitor_entries
        GROUP BY 1
        ORDER BY 1
      `,
      this.groupByStatus("vehicles", "type"),
      prisma.$queryRaw`
        SELECT * FROM visitor_entries
        ORDER BY "entryTime" DESC NULLS LAST, id DESC
        LIMIT 8
      `,
      prisma.$queryRaw`
        SELECT * FROM passes
        WHERE status = 'Active'
        ORDER BY "createdAt" DESC NULLS LAST, id DESC
        LIMIT 8
      `,
    ]);

    const trendMap = new Map(visitorTrendRows.map((r) => [r.day, { entries: toNumber(r.entries), active: toNumber(r.active) }]));
    const visitorTrend = days.map(({ key, label }) => ({
      day: label,
      date: key,
      entries: trendMap.get(key)?.entries || 0,
      active: trendMap.get(key)?.active || 0,
    }));

    return responseHeader("security", {
      stats: [
        { key: "visitorsToday", label: "Visitors Today", value: visitorsToday, format: "number" },
        { key: "activeVisitors", label: "Visitors On Site", value: activeVisitors, format: "number" },
        { key: "vehicles", label: "Registered Vehicles", value: vehicles, format: "number" },
        { key: "blockedVehicles", label: "Blocked Vehicles", value: blockedVehicles, format: "number" },
        { key: "guards", label: "Active Guards", value: guards, format: "number" },
        { key: "passes", label: "Active Passes", value: passes, format: "number" },
      ],
      charts: {
        visitorTrend,
        gateBreakdown: gateBreakdown.map((r) => ({ label: r.label, count: toNumber(r.count) })),
        vehicleTypes,
      },
      lists: {
        recentVisitors: toDocs(recentVisitors),
        expiringPasses: toDocs(expiringPasses),
      },
    });
  }

  static async property() {
    const [
      totalPlots,
      occupied,
      available,
      possessionPending,
      transfersPending,
      nocsPending,
      plotStatus,
      blockOccupancyRows,
      booked,
      constructionActive,
      recentTransfers,
      recentNocs,
      lowStock,
    ] = await Promise.all([
      this.count("plots"),
      this.count("plots", `"currentOwner" IS NOT NULL`),
      this.count("plots", `status = '${Plot.STATUS.AVAILABLE}'`),
      this.count("possession_applications", `status NOT IN ('Possessed', 'Rejected')`),
      this.count("transfer_requests", `status NOT IN ('Completed', 'Rejected')`),
      this.count("noc_applications", `status <> 'Issued'`),
      this.groupByStatus("plots"),
      prisma.$queryRaw`
        SELECT COALESCE(b.name, 'Unassigned') AS block,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE p."currentOwner" IS NOT NULL)::int AS occupied,
               COUNT(*) FILTER (WHERE p.status = 'Available')::int AS available
        FROM plots p
        LEFT JOIN blocks b ON b.id = p.block
        GROUP BY 1
        ORDER BY 1
      `,
      this.count("plots", `status = '${Plot.STATUS.BOOKED}'`),
      this.count("construction_applications", `status <> 'Rejected'`),
      prisma.$queryRaw`
        SELECT * FROM transfer_requests
        ORDER BY "createdAt" DESC NULLS LAST, id DESC
        LIMIT 8
      `,
      prisma.$queryRaw`
        SELECT * FROM noc_applications
        ORDER BY "createdAt" DESC NULLS LAST, id DESC
        LIMIT 8
      `,
      this.lowStock(),
    ]);

    const pipeline = [
      { stage: "Bookings", value: booked },
      { stage: "Possession", value: possessionPending },
      { stage: "NOCs", value: nocsPending },
      { stage: "Transfers", value: transfersPending },
      { stage: "Construction", value: constructionActive },
    ];

    const blockOccupancy = blockOccupancyRows.map((item) => {
      const total = toNumber(item.total);
      const occ = toNumber(item.occupied);
      return {
        block: item.block,
        total,
        occupied: occ,
        available: toNumber(item.available),
        occupancyRate: total ? Number(((occ / total) * 100).toFixed(1)) : 0,
      };
    });

    return responseHeader("property", {
      stats: [
        { key: "totalPlots", label: "Total Plots", value: totalPlots, format: "number" },
        { key: "occupied", label: "Occupied Plots", value: occupied, format: "number" },
        { key: "available", label: "Available Plots", value: available, format: "number" },
        { key: "possession", label: "Possession Pending", value: possessionPending, format: "number" },
        { key: "transfers", label: "Transfers Pending", value: transfersPending, format: "number" },
        { key: "nocs", label: "NOCs Pending", value: nocsPending, format: "number" },
      ],
      charts: {
        plotStatus,
        blockOccupancy,
        workflow: pipeline,
      },
      lists: {
        recentTransfers: toDocs(recentTransfers),
        recentNocs: toDocs(recentNocs),
      },
      lowStock,
    });
  }

  static async get(type) {
    const cached = cache.get(type);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

    let value;
    if (type === "management") value = await this.management();
    else if (type === "finance") value = await this.finance();
    else if (type === "operations") value = await this.operations();
    else if (type === "security") value = await this.security();
    else if (type === "property") value = await this.property();
    else {
      const ApiError = require("../../utils/ApiError");
      throw new ApiError(404, "Dashboard type not found");
    }

    cache.set(type, { at: Date.now(), value });
    return value;
  }
}

module.exports = DashboardService;
