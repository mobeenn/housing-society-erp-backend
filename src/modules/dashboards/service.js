const { db } = require("../../config/db");
const { Plot } = require("../properties/plot.model");
const { OPEN_STATUSES } = require("../complaints/complaint.config");

const sum = (records, field) => records.reduce((total, record) => total + Number(record[field] || 0), 0);
const now = () => new Date();
const monthKey = (value) => String(value || "").slice(0, 7);
const dateKey = (value) => String(value || "").slice(0, 10);

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

const groupCount = (records, field, label = field) => {
  const groups = new Map();
  records.forEach((record) => {
    const value = record[field] || "Unspecified";
    groups.set(value, (groups.get(value) || 0) + 1);
  });
  return Array.from(groups, ([key, count]) => ({ [label]: key, count }));
};

const responseHeader = (type, extra = {}) => ({
  type,
  generatedAt: new Date().toISOString(),
  currency: "PKR",
  ...extra,
});

class DashboardService {
  static async loadData() {
    const names = [
      "members",
      "plots",
      "blocks",
      "installments",
      "payments",
      "expenses",
      "complaints",
      "workOrders",
      "assets",
      "visitorEntries",
      "vehicles",
      "guards",
      "passes",
      "employees",
      "purchaseOrders",
      "vendors",
      "inventoryItems",
      "transferRequests",
      "nocApplications",
      "possessionApplications",
      "constructionApplications",
    ];
    const values = await Promise.all(names.map((name) => db.collection(name).find({})));
    return Object.fromEntries(names.map((name, index) => [name, values[index]]));
  }

  static lowStock(items) {
    return (items || [])
      .filter((item) => Number(item.quantity || 0) <= Number(item.reorderLevel || 0))
      .map((item) => ({ ...item, shortage: Math.max(0, Number(item.reorderLevel || 0) - Number(item.quantity || 0)) }))
      .sort((a, b) => b.shortage - a.shortage);
  }

  static financialTrend(data) {
    const months = lastMonths();
    return months.map(({ key, label }) => ({
      month: label,
      period: key,
      billed: sum(data.installments.filter((item) => monthKey(item.dueDate) === key), "amount"),
      collected: sum(data.payments.filter((item) => monthKey(item.createdAt) === key && item.status === "Completed"), "amount"),
      expenses: sum(data.expenses.filter((item) => monthKey(item.date) === key && item.status === "Paid"), "amount"),
    }));
  }

  static management(data) {
    const occupied = data.plots.filter((plot) => plot.currentOwner && [Plot.STATUS.ALLOTTED, Plot.STATUS.SOLD, Plot.STATUS.TRANSFERRED, Plot.STATUS.POSSESSED, Plot.STATUS.UNDER_CONSTRUCTION, Plot.STATUS.CONSTRUCTED].includes(plot.status));
    const openComplaints = data.complaints.filter((item) => OPEN_STATUSES.includes(item.status));
    return responseHeader("management", {
      stats: [
        { key: "members", label: "Total Members", value: data.members.length, format: "number" },
        { key: "activeMembers", label: "Active Members", value: data.members.filter((item) => item.status === "Active").length, format: "number" },
        { key: "plots", label: "Total Plots", value: data.plots.length, format: "number" },
        { key: "occupancy", label: "Occupancy Rate", value: data.plots.length ? Number(((occupied.length / data.plots.length) * 100).toFixed(1)) : 0, format: "percent" },
        { key: "dues", label: "Outstanding Dues", value: sum(data.installments, "balance"), format: "currency" },
        { key: "complaints", label: "Open Complaints", value: openComplaints.length, format: "number" },
        { key: "employees", label: "Active Employees", value: data.employees.filter((item) => ["Active", "On Leave"].includes(item.status)).length, format: "number" },
        { key: "collection", label: "Collected This Month", value: sum(data.payments.filter((item) => monthKey(item.createdAt) === monthKey(new Date()) && item.status === "Completed"), "amount"), format: "currency" },
      ],
      charts: {
        financialTrend: this.financialTrend(data),
        plotStatus: groupCount(data.plots, "status", "label"),
        complaintStatus: groupCount(data.complaints, "status", "label"),
      },
      lists: {
        recentPayments: data.payments.slice(0, 6),
        openComplaints: openComplaints.slice(0, 6),
      },
      lowStock: this.lowStock(data.inventoryItems),
    });
  }

  static finance(data) {
    const defaulters = new Map();
    data.installments.filter((item) => Number(item.balance || 0) > 0).forEach((item) => {
      const current = defaulters.get(item.member) || { memberId: item.member, amount: 0, installments: 0 };
      current.amount += Number(item.balance || 0);
      current.installments += 1;
      defaulters.set(item.member, current);
    });
    const memberNames = new Map(data.members.map((member) => [member._id, member.name]));
    const dues = Array.from(defaulters.values()).map((item) => ({ ...item, memberName: memberNames.get(item.memberId) || "Unknown" })).sort((a, b) => b.amount - a.amount).slice(0, 8);
    return responseHeader("finance", {
      stats: [
        { key: "collected", label: "Collected This Month", value: sum(data.payments.filter((item) => monthKey(item.createdAt) === monthKey(new Date()) && item.status === "Completed"), "amount"), format: "currency" },
        { key: "outstanding", label: "Outstanding Dues", value: sum(data.installments, "balance"), format: "currency" },
        { key: "overdue", label: "Overdue Dues", value: sum(data.installments.filter((item) => item.status === "Overdue"), "balance"), format: "currency" },
        { key: "expenses", label: "Paid Expenses", value: sum(data.expenses.filter((item) => item.status === "Paid"), "amount"), format: "currency" },
        { key: "payments", label: "Payment Count", value: data.payments.filter((item) => item.status === "Completed").length, format: "number" },
        { key: "defaulters", label: "Defaulters", value: defaulters.size, format: "number" },
      ],
      charts: {
        financialTrend: this.financialTrend(data),
        duesStatus: groupCount(data.installments.filter((item) => Number(item.balance || 0) > 0), "status", "label"),
        defaulters: dues.map((item) => ({ label: item.memberName, amount: item.amount, value: item.amount })),
      },
      lists: { defaulters: dues },
      lowStock: this.lowStock(data.inventoryItems),
    });
  }

  static operations(data) {
    const open = data.complaints.filter((item) => OPEN_STATUSES.includes(item.status));
    const months = lastMonths();
    const complaintTrend = months.map(({ key, label }) => ({ month: label, period: key, created: data.complaints.filter((item) => monthKey(item.createdAt) === key).length, resolved: data.complaints.filter((item) => monthKey(item.resolvedAt) === key).length }));
    return responseHeader("operations", {
      stats: [
        { key: "openComplaints", label: "Open Complaints", value: open.length, format: "number" },
        { key: "overdue", label: "SLA Breaches", value: open.filter((item) => item.slaDueDate && new Date(item.slaDueDate) < new Date()).length, format: "number" },
        { key: "workOrders", label: "Open Work Orders", value: data.workOrders.filter((item) => ["Open", "InProgress"].includes(item.status)).length, format: "number" },
        { key: "resolved", label: "Resolved Complaints", value: data.complaints.filter((item) => ["Resolved", "Closed"].includes(item.status)).length, format: "number" },
        { key: "assets", label: "Registered Assets", value: data.assets.length, format: "number" },
        { key: "staff", label: "Operations Staff", value: data.employees.filter((item) => ["Operations", "Administration"].includes(item.department)).length, format: "number" },
      ],
      charts: {
        complaintTrend,
        complaintStatus: groupCount(data.complaints, "status", "label"),
        workOrderStatus: groupCount(data.workOrders, "status", "label"),
      },
      lists: { openComplaints: open.slice(0, 8), workOrders: data.workOrders.filter((item) => ["Open", "InProgress"].includes(item.status)).slice(0, 8) },
      lowStock: this.lowStock(data.inventoryItems),
    });
  }

  static security(data) {
    const days = lastDays();
    const visitorTrend = days.map(({ key, label }) => ({ day: label, date: key, entries: data.visitorEntries.filter((item) => dateKey(item.entryTime) === key).length, active: data.visitorEntries.filter((item) => dateKey(item.entryTime) === key && !item.exitTime).length }));
    return responseHeader("security", {
      stats: [
        { key: "visitorsToday", label: "Visitors Today", value: data.visitorEntries.filter((item) => dateKey(item.entryTime) === dateKey(new Date())).length, format: "number" },
        { key: "activeVisitors", label: "Visitors On Site", value: data.visitorEntries.filter((item) => !item.exitTime).length, format: "number" },
        { key: "vehicles", label: "Registered Vehicles", value: data.vehicles.length, format: "number" },
        { key: "blockedVehicles", label: "Blocked Vehicles", value: data.vehicles.filter((item) => item.status === "Blocked").length, format: "number" },
        { key: "guards", label: "Active Guards", value: data.guards.filter((item) => item.status === "Active").length, format: "number" },
        { key: "passes", label: "Active Passes", value: data.passes.filter((item) => item.status === "Active").length, format: "number" },
      ],
      charts: {
        visitorTrend,
        gateBreakdown: groupCount(data.visitorEntries, "gate", "label"),
        vehicleTypes: groupCount(data.vehicles, "type", "label"),
      },
      lists: { recentVisitors: data.visitorEntries.slice(0, 8), expiringPasses: data.passes.filter((item) => item.status === "Active").slice(0, 8) },
    });
  }

  static property(data) {
    const blocks = new Map();
    const blockNames = new Map((data.blocks || []).map((block) => [block._id, block.name]));
    data.plots.forEach((plot) => {
      const key = blockNames.get(plot.block) || "Unassigned";
      const current = blocks.get(key) || { block: key, total: 0, occupied: 0, available: 0 };
      current.total += 1;
      if (plot.currentOwner) current.occupied += 1;
      if (plot.status === Plot.STATUS.AVAILABLE) current.available += 1;
      blocks.set(key, current);
    });
    const pipeline = [
      { stage: "Bookings", value: data.plots.filter((item) => item.status === Plot.STATUS.BOOKED).length },
      { stage: "Possession", value: data.possessionApplications.filter((item) => !["Possessed", "Rejected"].includes(item.status)).length },
      { stage: "NOCs", value: data.nocApplications.filter((item) => item.status !== "Issued").length },
      { stage: "Transfers", value: data.transferRequests.filter((item) => !["Completed", "Rejected"].includes(item.status)).length },
      { stage: "Construction", value: data.constructionApplications.filter((item) => item.status !== "Rejected").length },
    ];
    return responseHeader("property", {
      stats: [
        { key: "totalPlots", label: "Total Plots", value: data.plots.length, format: "number" },
        { key: "occupied", label: "Occupied Plots", value: data.plots.filter((item) => item.currentOwner).length, format: "number" },
        { key: "available", label: "Available Plots", value: data.plots.filter((item) => item.status === Plot.STATUS.AVAILABLE).length, format: "number" },
        { key: "possession", label: "Possession Pending", value: pipeline[1].value, format: "number" },
        { key: "transfers", label: "Transfers Pending", value: pipeline[3].value, format: "number" },
        { key: "nocs", label: "NOCs Pending", value: pipeline[2].value, format: "number" },
      ],
      charts: {
        plotStatus: groupCount(data.plots, "status", "label"),
        blockOccupancy: Array.from(blocks.values()).map((item) => ({ ...item, occupancyRate: item.total ? Number(((item.occupied / item.total) * 100).toFixed(1)) : 0 })),
        workflow: pipeline,
      },
      lists: { recentTransfers: data.transferRequests.slice(0, 8), recentNocs: data.nocApplications.slice(0, 8) },
      lowStock: this.lowStock(data.inventoryItems),
    });
  }

  static async get(type) {
    const data = await this.loadData();
    if (type === "management") return this.management(data);
    if (type === "finance") return this.finance(data);
    if (type === "operations") return this.operations(data);
    if (type === "security") return this.security(data);
    if (type === "property") return this.property(data);
    const ApiError = require("../../utils/ApiError");
    throw new ApiError(404, "Dashboard type not found");
  }
}

module.exports = DashboardService;
