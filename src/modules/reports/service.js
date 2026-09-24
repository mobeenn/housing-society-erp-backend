const { db } = require("../../config/db");
const Member = require("../members/member.model");
const { User } = require("../auth/user.model");
const { Complaint } = require("../complaints/complaint.model");
const { OPEN_STATUSES } = require("../complaints/complaint.config");
const { Department } = require("../administration/masterData.model");
const { Plot } = require("../properties/plot.model");
const extendedReports = require("./extended");
const ApiError = require("../../utils/ApiError");

const getDateRange = ({ startDate, endDate }) => {
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : now;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new ApiError(400, "Invalid report date range");
  return { start: start.toISOString(), end: end.toISOString() };
};

const matchDate = (field, range, extra = {}) => ({ ...extra, [field]: { $gte: range.start, $lte: range.end } });

class ReportService {
  static async collection(filters) {
    const range = getDateRange(filters); const format = filters.interval === "daily" ? "%Y-%m-%d" : "%Y-%m";
    const data = await db.collection("payments").aggregate([{ $match: matchDate("createdAt", range, { status: "Completed" }) }, { $group: { _id: { $dateToString: { format, date: "$createdAt" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    return { report: "collection", range, interval: filters.interval === "daily" ? "daily" : "monthly", data: data.map((row) => ({ period: row._id, amount: row.amount, count: row.count })), total: data.reduce((sum, row) => sum + row.amount, 0) };
  }

  static async dues(filters) {
    const range = getDateRange(filters);
    const data = await db.collection("installments").aggregate([{ $match: matchDate("dueDate", range, { balance: { $gt: 0 } }) }, { $group: { _id: "$status", amount: { $sum: "$balance" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    return { report: "dues", range, data: data.map((row) => ({ status: row._id, amount: row.amount, count: row.count })), total: data.reduce((sum, row) => sum + row.amount, 0) };
  }

  static async defaulters(filters) {
    const range = getDateRange(filters); const today = new Date().toISOString();
    const data = await db.collection("installments").aggregate([{ $match: { dueDate: { $gte: range.start, $lte: range.end, $lt: today }, balance: { $gt: 0 } } }, { $group: { _id: "$member", amount: { $sum: "$balance" }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]);
    const rows = await Promise.all(data.map(async (row) => ({ memberId: row._id, member: await Member.findById(row._id), overdueAmount: row.amount, installments: row.count })));
    return { report: "defaulters", range, data: rows.map((row) => ({ memberId: row.memberId, memberName: row.member?.name || "Unknown", memberNumber: row.member?.memberId || "—", overdueAmount: row.overdueAmount, installments: row.installments })), total: rows.reduce((sum, row) => sum + row.overdueAmount, 0) };
  }

  static async incomeExpense(filters) {
    const range = getDateRange(filters); const format = filters.interval === "daily" ? "%Y-%m-%d" : "%Y-%m";
    const [income, expense] = await Promise.all([
      db.collection("payments").aggregate([{ $match: matchDate("createdAt", range, { status: "Completed" }) }, { $group: { _id: { $dateToString: { format, date: "$createdAt" } }, amount: { $sum: "$amount" } } }, { $sort: { _id: 1 } }]),
      db.collection("expenses").aggregate([{ $match: matchDate("date", range, { status: "Paid" }) }, { $group: { _id: { $dateToString: { format, date: "$date" } }, amount: { $sum: "$amount" } } }, { $sort: { _id: 1 } }]),
    ]);
    const periods = new Map(); income.forEach((row) => periods.set(row._id, { period: row._id, income: row.amount, expense: 0 })); expense.forEach((row) => periods.set(row._id, { period: row._id, income: periods.get(row._id)?.income || 0, expense: row.amount }));
    const data = Array.from(periods.values()).sort((a, b) => a.period.localeCompare(b.period));
    return { report: "income-expense", range, data, totals: { income: data.reduce((sum, row) => sum + row.income, 0), expense: data.reduce((sum, row) => sum + row.expense, 0) } };
  }

  static async refunds(filters) {
    const range = getDateRange(filters);
    const data = await db.collection("refunds").aggregate([{ $match: matchDate("createdAt", range) }, { $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    return { report: "refunds", range, data: data.map((row) => ({ status: row._id, amount: row.amount, count: row.count })), total: data.reduce((sum, row) => sum + row.amount, 0) };
  }

  /** Complaints report: open / overdue / by-category / by-department / avg resolution time */
  static async complaints(filters = {}) {
    const range = filters.startDate || filters.endDate ? getDateRange(filters) : null;
    const rangeMatch = range ? matchDate("createdAt", range) : {};
    const nowIso = new Date().toISOString();

    // Aggregations over the complaints collection
    const [byStatus, byCategory, byDepartmentAgg, overdue, resolved] = await Promise.all([
      db.collection(Complaint.collectionName).aggregate([{ $match: rangeMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      db.collection(Complaint.collectionName).aggregate([{ $match: rangeMatch }, { $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      db.collection(Complaint.collectionName).aggregate([{ $match: rangeMatch }, { $group: { _id: "$assignedDepartment", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      db.collection(Complaint.collectionName).countDocuments({ ...rangeMatch, status: { $in: OPEN_STATUSES }, slaDueDate: { $lt: nowIso } }),
      db.collection(Complaint.collectionName).find({ ...rangeMatch, status: Complaint.STATUS.RESOLVED, resolvedAt: { $ne: null } }),
    ]);

    const open = byStatus
      .filter((row) => OPEN_STATUSES.includes(row._id))
      .reduce((sum, row) => sum + row.count, 0);
    const total = byStatus.reduce((sum, row) => sum + row.count, 0);

    const byDepartment = await Promise.all(
      byDepartmentAgg.map(async (row) => {
        const department = row._id ? await Department.findById(row._id) : null;
        return { departmentId: row._id || null, departmentName: department?.name || "Unassigned", count: row.count };
      })
    );

    const resolutionHours = resolved.map(
      (c) => (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime()) / 3600000
    );
    const avgResolutionTimeHours = resolutionHours.length
      ? Number((resolutionHours.reduce((sum, h) => sum + h, 0) / resolutionHours.length).toFixed(2))
      : null;

    return {
      report: "complaints",
      range,
      data: {
        total,
        open,
        overdue,
        resolved: resolved.length,
        avgResolutionTimeHours,
        byStatus: byStatus.map((row) => ({ status: row._id, count: row.count })),
        byCategory: byCategory.map((row) => ({ category: row._id, count: row.count })),
        byDepartment,
      },
    };
  }

  /** Aggregated dashboard data consumed by the React dashboard. */
  static async dashboard() {
    const now = new Date();
    const nowIso = now.toISOString();
    const currentMonthKey = nowIso.slice(0, 7);

    const [
      members,
      plots,
      installments,
      payments,
      expenses,
      complaints,
      workOrders,
      visitors,
      employees,
      purchaseOrders,
    ] = await Promise.all([
      db.collection("members").find({}),
      db.collection("plots").find({}),
      db.collection("installments").find({}),
      db.collection("payments").find({}),
      db.collection("expenses").find({}),
      db.collection(Complaint.collectionName).find({}),
      db.collection("workOrders").find({}),
      db.collection("visitorEntries").find({}),
      db.collection("employees").find({}),
      db.collection("purchaseOrders").find({}),
    ]);

    const memberById = new Map(members.map((member) => [member._id, member]));
    const plotById = new Map(plots.map((plot) => [plot._id, plot]));
    const plotStatus = Plot.STATUS;
    const occupiedStatuses = new Set([
      plotStatus.ALLOTTED,
      plotStatus.SOLD,
      plotStatus.TRANSFERRED,
      plotStatus.POSSESSED,
      plotStatus.UNDER_CONSTRUCTION,
      plotStatus.CONSTRUCTED,
    ]);
    const activePlots = plots.filter(
      (plot) =>
        plot.currentOwner &&
        occupiedStatuses.has(plot.status) &&
        plot.status !== plotStatus.CANCELLED
    );
    const pendingWorkOrders = workOrders.filter((workOrder) =>
      ["Open", "InProgress"].includes(workOrder.status)
    );
    const outstandingDues = installments.reduce(
      (sum, installment) => sum + Number(installment.balance || 0),
      0
    );
    const overdueDues = installments
      .filter(
        (installment) =>
          Number(installment.balance || 0) > 0 &&
          (installment.status === "Overdue" ||
            (installment.dueDate && installment.dueDate < nowIso && installment.status !== "Paid"))
      )
      .reduce((sum, installment) => sum + Number(installment.balance || 0), 0);
    const collectedThisMonth = payments
      .filter((payment) => payment.status === "Completed" && payment.createdAt?.startsWith(currentMonthKey))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const expensesThisMonth = expenses
      .filter((expense) => expense.status === "Paid" && expense.date?.startsWith(currentMonthKey))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
      return {
        key: date.toISOString().slice(0, 7),
        label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      };
    });
    const financialTrend = monthKeys.map(({ key, label }) => ({
      month: label,
      period: key,
      billed: installments
        .filter((installment) => installment.dueDate?.startsWith(key))
        .reduce((sum, installment) => sum + Number(installment.amount || 0), 0),
      collected: payments
        .filter((payment) => payment.status === "Completed" && payment.createdAt?.startsWith(key))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      expenses: expenses
        .filter((expense) => expense.status === "Paid" && expense.date?.startsWith(key))
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    }));

    const groupCount = (records, field) => {
      const counts = new Map();
      for (const record of records) {
        const label = record[field] || "Unspecified";
        counts.set(label, (counts.get(label) || 0) + 1);
      }
      return Array.from(counts, ([label, count]) => ({ label, count }));
    };

    const recentPayments = [...payments]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 6)
      .map((payment) => ({
        _id: payment._id,
        receiptNumber: payment.receiptNumber,
        memberId: payment.member,
        memberName: memberById.get(payment.member)?.name || "Unknown member",
        plotNumber: plotById.get(payment.plot)?.plotNumber || null,
        amount: Number(payment.amount || 0),
        method: payment.method,
        status: payment.status,
        date: payment.createdAt,
      }));

    const recentComplaints = [...complaints]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 5)
      .map((complaint) => ({
        _id: complaint._id,
        complaintNumber: complaint.complaintNumber,
        memberName: memberById.get(complaint.member)?.name || "Common area",
        plotNumber: plotById.get(complaint.plot)?.plotNumber || null,
        category: complaint.category,
        priority: complaint.priority,
        status: complaint.status,
        createdAt: complaint.createdAt,
      }));

    return {
      generatedAt: nowIso,
      currency: "PKR",
      stats: {
        totalMembers: members.length,
        activeMembers: members.filter((member) => member.status === "Active").length,
        totalPlots: plots.length,
        activePlots: activePlots.length,
        availablePlots: plots.filter((plot) => plot.status === plotStatus.AVAILABLE).length,
        occupancyRate: plots.length ? Number(((activePlots.length / plots.length) * 100).toFixed(1)) : 0,
        outstandingDues,
        overdueDues,
        collectedThisMonth,
        expensesThisMonth,
        openComplaints: complaints.filter((complaint) => OPEN_STATUSES.includes(complaint.status)).length,
        pendingWorkOrders: pendingWorkOrders.length,
        activeVisitors: visitors.filter((visitor) => !visitor.exitTime).length,
        activeEmployees: employees.filter((employee) => ["Active", "On Leave"].includes(employee.status)).length,
        procurementCommitment: purchaseOrders
          .filter((order) => !["Draft", "Cancelled"].includes(order.status))
          .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      },
      financialTrend,
      plotStatusDistribution: groupCount(plots, "status"),
      complaintStatusDistribution: groupCount(complaints, "status"),
      recentPayments,
      recentComplaints,
    };
  }

  static async catalog() {
    const existing = [
      { key: "collection", module: "Finance", label: "Collection", description: "Completed payment collections." },
      { key: "dues", module: "Finance", label: "Dues", description: "Outstanding installment balances." },
      { key: "defaulters", module: "Finance", label: "Defaulters", description: "Members with overdue installments." },
      { key: "income-expense", module: "Finance", label: "Income vs Expense", description: "Income and paid expenses over time." },
      { key: "refunds", module: "Finance", label: "Refunds", description: "Refund requests and payments." },
      { key: "complaints", module: "Operations", label: "Complaint Summary", description: "Complaint volume, SLA and resolution." },
    ];
    return [...existing, ...extendedReports.catalog];
  }

  static async run(type, filters) {
    if (type === "collection") return this.collection(filters);
    if (type === "dues") return this.dues(filters);
    if (type === "defaulters") return this.defaulters(filters);
    if (type === "income-expense") return this.incomeExpense(filters);
    if (type === "refunds") return this.refunds(filters);
    if (type === "complaints") return this.complaints(filters);
    const extended = await extendedReports.run(type, filters);
    if (extended) return extended;
    throw new ApiError(404, "Report type not found");
  }
}

module.exports = { ReportService, getDateRange };