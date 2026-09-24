const BuyBack = require("./buyback.model");
const { Plot } = require("../properties/plot.model");
const PlotService = require("../properties/service");
const { canTransition } = require("../properties/stateMachine");
const { Booking } = require("../bookings/booking.model");
const InvoiceService = require("../invoices/service");
const ApiError = require("../../utils/ApiError");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const { createLifecyclePdf } = require("../lifecycle/pdf");

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const safePlot = (plot) => plot ? { _id: plot._id, plotNumber: plot.plotNumber, fileNumber: plot.fileNumber, status: plot.status } : null;
const safeBooking = (booking) => booking ? { _id: booking._id, bookingDate: booking.bookingDate, status: booking.status, plot: booking.plot, member: booking.member, bookingAmount: booking.bookingAmount } : null;

async function enrich(record) {
  if (!record) return null;
  const [plot, booking] = await Promise.all([Plot.findById(record.plot), Booking.findById(record.booking)]);
  return { ...record, plotRef: safePlot(plot), bookingRef: safeBooking(booking) };
}

class BuyBackService {
  static async eligibleBookings() {
    const bookings = await Booking.find({}, { sort: { bookingDate: -1 } });
    const rows = bookings.filter((booking) => !booking.archived && !booking.isArchived && [Booking.STATUS.PENDING_APPROVAL, Booking.STATUS.CONFIRMED].includes(booking.status));
    const enriched = await Promise.all(rows.map(async (booking) => {
      const plot = await Plot.findById(booking.plot);
      return {
        ...safeBooking(booking),
        plotRef: safePlot(plot),
        eligible: Boolean(plot && canTransition(plot.status, Plot.STATUS.AVAILABLE)),
      };
    }));
    return enriched.filter((booking) => booking.eligible);
  }

  static async list({ page = 1, limit = 50, type, status } = {}) {
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    const rows = await BuyBack.find(query, { sort: { date: -1 } });
    const currentPage = Math.max(1, number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, number(limit) || 50));
    const start = (currentPage - 1) * pageSize;
    return {
      data: await Promise.all(rows.slice(start, start + pageSize).map(enrich)),
      pagination: { page: currentPage, limit: pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) },
    };
  }

  static async get(id) {
    const record = await BuyBack.findById(id);
    if (!record) throw new ApiError(404, "Buyback record not found");
    return enrich(record);
  }

  static async execute(data, req) {
    const booking = await Booking.findById(data.booking);
    if (!booking) throw new ApiError(404, "Booking not found");
    if (booking.archived === true || booking.isArchived === true) throw new ApiError(409, "Booking is already archived");
    if (![Booking.STATUS.PENDING_APPROVAL, Booking.STATUS.CONFIRMED].includes(booking.status)) {
      throw new ApiError(409, `Only active bookings can be bought back or cancelled (current status: ${booking.status})`);
    }
    const existing = await BuyBack.findActiveByBooking(booking._id);
    if (existing) throw new ApiError(409, "This booking already has a buyback/cancel action");
    const plot = await Plot.findById(booking.plot);
    if (!plot) throw new ApiError(400, "Booking plot not found");
    const nextPlotStatus = data.type === BuyBack.TYPE.CANCEL ? Plot.STATUS.CANCELLED : Plot.STATUS.AVAILABLE;
    if (!canTransition(plot.status, nextPlotStatus)) {
      throw new ApiError(409, `Plot cannot transition from ${plot.status} to ${nextPlotStatus}`);
    }

    const pending = await BuyBack.create({
      plot: plot._id,
      booking: booking._id,
      type: data.type,
      paymentType: data.paymentType,
      deductionPercent: number(data.deductionPercent),
      settlementAmount: number(data.settlementAmount),
      performedBy: req.user._id,
      date: new Date().toISOString(),
      status: BuyBack.STATUS.PENDING,
    });

    try {
      const invoice = await InvoiceService.registerInvoice("BuyBack", pending, {
        relatedEntityType: "BuyBack",
        relatedEntityId: pending._id,
        fileUrl: `/api/buyback/${pending._id}/invoice.pdf`,
        plot: plot._id,
        member: booking.member || null,
        amount: number(data.settlementAmount),
        issueDate: pending.date,
        createdBy: req.user._id,
      });
      const archivedAt = new Date().toISOString();
      await PlotService.update(plot._id, {
        status: nextPlotStatus,
        currentOwner: null,
        lifecycleAction: data.type === BuyBack.TYPE.CANCEL ? "Cancelled" : "BoughtBack",
        lifecycleRecord: pending._id,
      }, req);
      await Booking.update(booking._id, {
        status: Booking.STATUS.CANCELLED,
        cancellationReason: data.remarks || data.type,
        cancelledAt: archivedAt,
        refundAmount: number(data.settlementAmount),
        archived: true,
        isArchived: true,
        archivedAt,
        archivedBy: req.user._id,
        archiveType: data.type,
        archiveReason: data.remarks || null,
        originalStatus: booking.status,
        lifecycleRecord: pending._id,
      });
      await BuyBack.update(pending._id, {
        status: BuyBack.STATUS.COMPLETED,
        invoiceId: invoice._id,
        invoiceUrl: invoice.fileUrl,
      });
      await createAuditLog({
        req,
        entityType: "BuyBack",
        entityId: pending._id,
        action: AuditLog.ACTIONS.CREATE,
        changes: { after: { ...pending, status: BuyBack.STATUS.COMPLETED, invoiceId: invoice._id } },
      });
      return this.get(pending._id);
    } catch (error) {
      await BuyBack.update(pending._id, { status: BuyBack.STATUS.FAILED, failureReason: error.message });
      throw error;
    }
  }

  static async invoicePdf(id) {
    const record = await this.get(id);
    if (record.status !== BuyBack.STATUS.COMPLETED) throw new ApiError(409, "Only completed buyback records have an invoice");
    return createLifecyclePdf({
      title: `${record.type} Settlement Invoice`,
      reference: record._id,
      lines: [
        { label: "Plot", value: record.plotRef?.plotNumber || record.plot },
        { label: "Booking", value: record.booking },
        { label: "Type", value: record.type },
        { label: "Payment type", value: record.paymentType },
        { label: "Deduction", value: `${record.deductionPercent}%` },
        { label: "Settlement amount", value: record.settlementAmount },
        { label: "Performed by", value: record.performedBy || "System" },
        { label: "Date", value: record.date },
      ],
      footer: "This document records an irreversible buyback/cancellation transaction.",
    });
  }
}

module.exports = BuyBackService;
