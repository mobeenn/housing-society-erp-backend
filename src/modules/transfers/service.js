const PDFDocument = require("pdfkit");
const TransferRequest = require("./transfer.model");
const { Plot, OwnershipHistory } = require("../properties/plot.model");
const { Installment } = require("../bookings/booking.model");
const Member = require("../members/member.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const { canTransition } = require("../properties/stateMachine");
const ApiError = require("../../utils/ApiError");
const NotificationService = require("../notifications/service");
const RbacService = require("../rbac/service");
const InvoiceService = require("../invoices/service");

class TransferService {
  static async create(data, req) {
    const plot = await Plot.findById(data.plot); if (!plot) throw new ApiError(400, "Plot not found");
    if (plot.currentOwner !== data.fromMember) throw new ApiError(409, "Transfer source member is not the current plot owner");
    if (!(await Member.findById(data.fromMember)) || !(await Member.findById(data.toMember))) throw new ApiError(400, "Both transfer members must exist");
    if (data.fromMember === data.toMember) throw new ApiError(400, "Transfer members must be different");
    const transfer = await TransferRequest.create(data, req.user._id); await createAuditLog({ req, entityType: "TransferRequest", entityId: transfer._id, action: AuditLog.ACTIONS.CREATE, changes: { after: transfer } }); return this.getById(transfer._id);
  }

  static async getById(id) { const transfer = await TransferRequest.findById(id); if (!transfer) throw new ApiError(404, "Transfer request not found"); const [plot, fromMember, toMember] = await Promise.all([Plot.findById(transfer.plot), Member.findById(transfer.fromMember), Member.findById(transfer.toMember)]); return { ...transfer, plotRef: plot, fromMemberRef: fromMember, toMemberRef: toMember }; }
  static async list({ status, page = 1, limit = 20 }) { const query = status ? { status } : {}; const all = await TransferRequest.find(query, { sort: { createdAt: -1 } }); const p = Number(page) || 1; const l = Number(limit) || 20; const data = await Promise.all(all.slice((p - 1) * l, p * l).map((item) => this.getById(item._id))); return { data, pagination: { page: p, limit: l, total: all.length, pages: Math.ceil(all.length / l) } }; }

  static async verify(id, req) {
    const transfer = await TransferRequest.findById(id); if (!transfer) throw new ApiError(404, "Transfer request not found"); if (![TransferRequest.STATUS.DRAFT, TransferRequest.STATUS.PENDING_VERIFICATION].includes(transfer.status)) throw new ApiError(409, "Transfer is not ready for verification");
    const plot = await Plot.findById(transfer.plot); const fromMember = await Member.findById(transfer.fromMember); const toMember = await Member.findById(transfer.toMember); if (!plot || !fromMember || !toMember) throw new ApiError(400, "Transfer references are incomplete");
    const installments = await Installment.find({ member: transfer.fromMember }); const outstanding = installments.filter((item) => item.plot === transfer.plot && Number(item.balance) > 0).reduce((sum, item) => sum + Number(item.balance), 0);
    const canOverride = await RbacService.isAllowed(req.user, "transfers", "edit");
    if (outstanding > 0 && !canOverride) throw new ApiError(409, `Outstanding dues of ${outstanding} block this transfer`);
    const now = new Date().toISOString(); const stages = transfer.approvalStages.map((stage) => stage.stage === "Verification" ? { ...stage, approver: req.user._id, status: "Completed", actedAt: now, remarks: outstanding > 0 ? "Dues override applied" : "Identity, ownership, dues, and restrictions verified" } : stage);
    await TransferRequest.update(id, { duesCleared: outstanding === 0, outstandingDues: outstanding, status: TransferRequest.STATUS.PENDING_APPROVAL, approvalStages: stages });
    await createAuditLog({ req, entityType: "TransferRequest", entityId: id, action: AuditLog.ACTIONS.STATUS_CHANGE, changes: { before: transfer, after: { status: TransferRequest.STATUS.PENDING_APPROVAL, duesCleared: outstanding === 0 } }, meta: outstanding > 0 ? { override: "transfers:override_dues", outstanding } : {} }); return this.getById(id);
  }

  static async approve(id, req) { const transfer = await TransferRequest.findById(id); if (!transfer) throw new ApiError(404, "Transfer request not found"); if (transfer.status !== TransferRequest.STATUS.PENDING_APPROVAL) throw new ApiError(409, "Transfer must pass verification before approval"); const stages = transfer.approvalStages.map((stage) => stage.stage === "Approval" ? { ...stage, approver: req.user._id, status: "Completed", actedAt: new Date().toISOString(), remarks: "Approved" } : stage); await TransferRequest.update(id, { status: TransferRequest.STATUS.APPROVED, approvalStages: stages }); await NotificationService.safeNotifyMembers([transfer.fromMember, transfer.toMember], { title: "Transfer approved", message: `Transfer request for plot ${transfer.plot} has been approved.`, relatedEntityType: "TransferRequest", relatedEntityId: id, eventType: "transfer.approved", eventKey: `transfer-approved:${id}` }); return this.getById(id); }
  static async reject(id, remarks, req) { const transfer = await TransferRequest.findById(id); if (!transfer) throw new ApiError(404, "Transfer request not found"); await TransferRequest.update(id, { status: TransferRequest.STATUS.REJECTED, rejectionRemarks: remarks }); await createAuditLog({ req, entityType: "TransferRequest", entityId: id, action: AuditLog.ACTIONS.REJECT, changes: { before: transfer, after: { status: TransferRequest.STATUS.REJECTED, remarks } } }); await NotificationService.safeNotifyMembers([transfer.fromMember, transfer.toMember], { title: "Transfer rejected", message: `Transfer request for plot ${transfer.plot} was rejected: ${remarks}`, relatedEntityType: "TransferRequest", relatedEntityId: id, eventType: "transfer.rejected", eventKey: `transfer-rejected:${id}` }); return this.getById(id); }

  static async complete(id, req) {
    const transfer = await TransferRequest.findById(id); if (!transfer) throw new ApiError(404, "Transfer request not found"); if (transfer.status !== TransferRequest.STATUS.APPROVED) throw new ApiError(409, "Only approved transfers can be completed");
    const plot = await Plot.findById(transfer.plot); const now = new Date().toISOString(); if (plot.currentOwner !== transfer.fromMember) throw new ApiError(409, "Plot ownership changed since verification"); if (plot.status !== Plot.STATUS.TRANSFERRED && !canTransition(plot.status, Plot.STATUS.TRANSFERRED)) throw new ApiError(409, `Plot cannot move from ${plot.status} to Transferred`);
    const oldHistory = await OwnershipHistory.findOne({ plot: plot._id, member: transfer.fromMember, toDate: null }); if (oldHistory) await OwnershipHistory.close(oldHistory._id, now);
    await OwnershipHistory.append({ plot: plot._id, member: transfer.toMember, fromDate: now, type: "transfer", remarks: `Transfer request ${id}` });
    await Plot.update(plot._id, { currentOwner: transfer.toMember, ownerSince: now, status: Plot.STATUS.TRANSFERRED }); await TransferRequest.update(id, { status: TransferRequest.STATUS.COMPLETED, completedAt: now }); await createAuditLog({ req, entityType: "TransferRequest", entityId: id, action: AuditLog.ACTIONS.UPDATE, changes: { before: transfer, after: { status: TransferRequest.STATUS.COMPLETED, plot: plot._id, fromMember: transfer.fromMember, toMember: transfer.toMember } } }); await NotificationService.safeNotifyMembers([transfer.fromMember, transfer.toMember], { title: "Transfer completed", message: `Ownership of plot ${plot.plotNumber} has been transferred.`, relatedEntityType: "TransferRequest", relatedEntityId: id, eventType: "transfer.completed", eventKey: `transfer-completed:${id}` }); const completed = await this.getById(id); await InvoiceService.safeRegisterInvoice("Transfer", completed, { fileUrl: `/api/transfers/${id}/certificate.pdf`, createdBy: req.user._id }); return completed;
  }

  static async certificate(id) { const transfer = await this.getById(id); if (transfer.status !== TransferRequest.STATUS.COMPLETED) throw new ApiError(409, "Transfer certificate is available after completion"); return new Promise((resolve) => { const chunks = []; const pdf = new PDFDocument({ margin: 50 }); pdf.on("data", (chunk) => chunks.push(chunk)); pdf.on("end", () => resolve({ transfer, buffer: Buffer.concat(chunks) })); pdf.fontSize(20).text("Housing Society Transfer Certificate", { align: "center" }).moveDown().fontSize(12).text(`Transfer ID: ${transfer._id}`).text(`Plot: ${transfer.plotRef?.plotNumber || transfer.plot}`).text(`From: ${transfer.fromMemberRef?.name || transfer.fromMember}`).text(`To: ${transfer.toMemberRef?.name || transfer.toMember}`).text(`Type: ${transfer.type}`).text(`Completed: ${new Date(transfer.completedAt).toLocaleString()}`).end(); }); }
}
module.exports = TransferService;