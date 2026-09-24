const Expense = require("./expense.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");
const InvoiceService = require("../invoices/service");

class ExpenseService {
  static async list({ category, status, startDate, endDate, page = 1, limit = 20 }) {
    const query = {}; if (category) query.category = category; if (status) query.status = status;
    if (startDate || endDate) { query.date = {}; if (startDate) query.date.$gte = new Date(startDate).toISOString(); if (endDate) query.date.$lte = new Date(`${endDate}T23:59:59.999Z`).toISOString(); }
    const all = await Expense.find(query, { sort: { date: -1 } }); const p = Number(page) || 1; const l = Number(limit) || 20;
    return { data: all.slice((p - 1) * l, p * l), pagination: { page: p, limit: l, total: all.length, pages: Math.ceil(all.length / l) } };
  }
  static async create(data, req) { const expense = await Expense.create(data, req.user._id); await createAuditLog({ req, entityType: "Expense", entityId: expense._id, action: AuditLog.ACTIONS.CREATE, changes: { after: expense } }); const fileUrl = expense.fileUrl || expense.invoiceUrl || expense.voucherUrl; if (fileUrl) await InvoiceService.safeRegisterInvoice("Expense", expense, { fileUrl, createdBy: req.user._id }); return expense; }
  static async transition(id, action, req) {
    const expense = await Expense.findById(id); if (!expense) throw new ApiError(404, "Expense not found");
    const transitions = { approve: [Expense.STATUS.PENDING, { status: Expense.STATUS.APPROVED, approvedBy: req.user._id }], reject: [Expense.STATUS.PENDING, { status: Expense.STATUS.REJECTED, rejectedBy: req.user._id }], pay: [Expense.STATUS.APPROVED, { status: Expense.STATUS.PAID, paidAt: new Date().toISOString() }] };
    const transition = transitions[action]; if (!transition || expense.status !== transition[0]) throw new ApiError(409, `Expense cannot be ${action} from ${expense.status}`);
    await Expense.update(id, transition[1]); const updated = await Expense.findById(id); await createAuditLog({ req, entityType: "Expense", entityId: id, action: AuditLog.ACTIONS.STATUS_CHANGE, changes: { before: expense, after: updated } }); if (action === "pay") await InvoiceService.safeRegisterInvoice("Expense", updated, { fileUrl: updated.fileUrl || updated.invoiceUrl || updated.voucherUrl || null, createdBy: req.user._id });
    return updated;
  }
}
module.exports = ExpenseService;