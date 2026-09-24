const { db } = require("../../config/db");
const { Payment, Refund } = require("./payment.model");
const { allocatePayment } = require("./allocationCalculator");
const { Installment } = require("../bookings/booking.model");
const SocietySettings = require("../administration/societySettings.model");
const Member = require("../members/member.model");
const { Plot } = require("../properties/plot.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");
const NotificationService = require("../notifications/service");
const InvoiceService = require("../invoices/service");

const getPenaltyRule = async () => (await SocietySettings.get()).feeSettings?.penaltyRule || { type: "flat", amount: 0, period: "day", graceDays: 0 };
const enrichPayment = async (payment) => payment ? { ...payment, memberRef: await Member.findById(payment.member), plotRef: payment.plot ? await Plot.findById(payment.plot) : null } : null;

class PaymentService {
  static async getInstallments(member, plot) { const records = await Installment.find({ member }, { sort: { dueDate: 1 } }); return records.filter((item) => (!plot || item.plot === plot) && Number(item.balance) > 0); }
  static async preview(data) { if (!(await Member.findById(data.member))) throw new ApiError(400, "Member not found"); const result = allocatePayment({ installments: await this.getInstallments(data.member, data.plot), paymentAmount: data.amount, penaltyRule: await getPenaltyRule() }); return { allocations: result.allocations, installmentUpdates: result.updates, totalAmount: Number(data.amount) }; }
  static async create(data, req) {
    if (!(await Member.findById(data.member))) throw new ApiError(400, "Member not found");
    if (data.plot && !(await Plot.findById(data.plot))) throw new ApiError(400, "Plot not found");
    const session = await db.startSession(); session.startTransaction();
    try {
      const allocation = allocatePayment({ installments: await this.getInstallments(data.member, data.plot), paymentAmount: data.amount, penaltyRule: await getPenaltyRule() });
      const payment = await Payment.create({ member: data.member, plot: data.plot || null, amount: Number(data.amount), method: data.method, allocations: allocation.allocations, collectedBy: req.user._id, remarks: data.remarks || null });
      for (const update of allocation.updates) await Installment.update(update.id, update);
      await session.commitTransaction(); await session.endSession();
      const saved = await enrichPayment(await Payment.findById(payment._id));
      await createAuditLog({ req, entityType: "Payment", entityId: payment._id, action: AuditLog.ACTIONS.CREATE, changes: { after: saved } });
      await NotificationService.safeNotifyMember(data.member, {
        title: "Payment received",
        message: `Payment of PKR ${Number(data.amount).toLocaleString()} was received. Receipt ${payment.receiptNumber}.`,
        relatedEntityType: "Payment",
        relatedEntityId: payment._id,
        eventType: "payment.received",
        eventKey: `payment-received:${payment._id}`,
      });
      await InvoiceService.safeRegisterInvoice("Installment", saved, { fileUrl: `/api/payments/${payment._id}/receipt.pdf` });
      return saved;
    } catch (error) { await session.abortTransaction(); await session.endSession(); throw error instanceof ApiError ? error : new ApiError(409, error.message); }
  }
  static async list({ member, plot, status, page = 1, limit = 20 }) { const query = {}; if (member) query.member = member; if (plot) query.plot = plot; if (status) query.status = status; const all = await Payment.find(query, { sort: { createdAt: -1 } }); const p = Number(page) || 1; const l = Number(limit) || 20; return { data: await Promise.all(all.slice((p - 1) * l, p * l).map(enrichPayment)), pagination: { page: p, limit: l, total: all.length, pages: Math.ceil(all.length / l) } }; }
  static async getById(id) { const payment = await Payment.findById(id); if (!payment) throw new ApiError(404, "Payment not found"); return enrichPayment(payment); }
  static async statement(memberId) {
    if (!(await Member.findById(memberId))) throw new ApiError(404, "Member not found");
    const installments = await Installment.find({ member: memberId }, { sort: { dueDate: 1 } }); const payments = await Payment.find({ member: memberId }, { sort: { createdAt: 1 } });
    const charges = installments.map((item) => ({ date: item.dueDate, type: "Installment", reference: item._id, debit: Number(item.amount) + Number(item.penaltyAmount || 0) - Number(item.discountAmount || 0), credit: 0, balance: Number(item.balance) }));
    const credits = payments.filter((item) => item.status === Payment.STATUS.COMPLETED).map((item) => ({ date: item.createdAt, type: "Payment", reference: item.receiptNumber, debit: 0, credit: Number(item.amount), balance: null }));
    let runningTotal = 0; const ledger = [...charges, ...credits].sort((a, b) => new Date(a.date) - new Date(b.date)).map((entry) => { runningTotal += entry.debit - entry.credit; return { ...entry, runningTotal }; });
    return { charges, payments: await Promise.all(payments.map(enrichPayment)), ledger, totalCharges: charges.reduce((sum, item) => sum + item.debit, 0), totalPayments: credits.reduce((sum, item) => sum + item.credit, 0), balance: runningTotal };
  }
  static async createRefund(data, req) { const refund = await Refund.create({ ...data, amount: Number(data.amount), createdBy: req.user._id }); await createAuditLog({ req, entityType: "Refund", entityId: refund._id, action: AuditLog.ACTIONS.CREATE, changes: { after: refund } }); return refund; }
  static async listRefunds() { return Refund.find({}, { sort: { createdAt: -1 } }); }
  static async updateRefund(id, action, req) { const refund = await Refund.findById(id); if (!refund) throw new ApiError(404, "Refund not found"); const transitions = { approve: [Refund.STATUS.PENDING, { status: Refund.STATUS.APPROVED, approvedBy: req.user._id }], reject: [Refund.STATUS.PENDING, { status: Refund.STATUS.REJECTED, rejectedBy: req.user._id }], pay: [Refund.STATUS.APPROVED, { status: Refund.STATUS.PAID, paidBy: req.user._id, paidAt: new Date().toISOString() }] }; const transition = transitions[action]; if (!transition || refund.status !== transition[0]) throw new ApiError(409, `Refund cannot be ${action} from ${refund.status}`); await Refund.update(id, transition[1]); const updated = await Refund.findById(id); await createAuditLog({ req, entityType: "Refund", entityId: id, action: AuditLog.ACTIONS.STATUS_CHANGE, changes: { before: refund, after: updated } }); return updated; }
}
module.exports = { PaymentService, getPenaltyRule };