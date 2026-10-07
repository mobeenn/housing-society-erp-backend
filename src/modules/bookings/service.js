const { db } = require("../../config/db");
const { Booking, InstallmentPlan, Installment } = require("./booking.model");
const { calculateNetPayable, calculateInstallmentSchedule } = require("./installmentCalculator");
const PlotService = require("../properties/service");
const { Plot } = require("../properties/plot.model");
const Member = require("../members/member.model");
const { AuditLog, createAuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");
const NotificationService = require("../notifications/service");

const decorateInstallment = (installment) => {
  if (installment.status === "Paid") return { ...installment, overdueDays: 0 };
  const today = new Date();
  const dueDate = new Date(installment.dueDate);
  const overdueDays = dueDate < today ? Math.floor((today - dueDate) / 86400000) : 0;
  const status = installment.paidAmount > 0
    ? (installment.balance > 0 ? "PartiallyPaid" : "Paid")
    : overdueDays > 0
      ? "Overdue"
      : dueDate.toDateString() === today.toDateString()
        ? "Due"
        : "Upcoming";
  return { ...installment, status, overdueDays };
};

const enrichBooking = async (booking) => {
  if (!booking) return null;
  const [member, plot, plan] = await Promise.all([
    Member.findById(booking.member),
    PlotService.getById(booking.plot),
    InstallmentPlan.findByBooking(booking._id),
  ]);
  let installments = [];
  if (plan) {
    const records = await Installment.find({ plan: plan._id }, { sort: { dueDate: 1 } });
    installments = records.map(decorateInstallment);
  }
  return { ...booking, memberRef: member, plotRef: plot, installmentPlan: plan ? { ...plan, installments } : null };
};

const ensureReferences = async (data) => {
  if (!(await Member.findById(data.member))) throw new ApiError(400, "Member not found");
  const plot = await Plot.findById(data.plot);
  if (!plot) throw new ApiError(400, "Plot not found");
  if (plot.status !== Plot.STATUS.AVAILABLE) throw new ApiError(409, `Plot is not available for booking; current status is ${plot.status}`);
  return plot;
};

class BookingService {
  static async preview(data) {
    const netPayable = calculateNetPayable(data);
    const schedule = calculateInstallmentSchedule({
      totalAmount: netPayable,
      bookingAmount: data.bookingAmount,
      numberOfInstallments: data.planTemplate.numberOfInstallments,
      frequency: data.planTemplate.frequency,
      firstDueDate: data.planTemplate.firstDueDate || new Date().toISOString(),
    });
    return { netPayable, bookingAmount: Number(data.bookingAmount), installmentTotal: schedule.totalAmount, installments: schedule.installments };
  }

  static async create(data, req) {
    await ensureReferences(data);
    const preview = await this.preview(data);
    const booking = await Booking.create({ ...data, bookingDate: data.bookingDate || new Date().toISOString(), price: Number(data.price), discount: Number(data.discount), developmentCharges: Number(data.developmentCharges), additionalCharges: Number(data.additionalCharges), bookingAmount: Number(data.bookingAmount) }, req.user._id);
    await PlotService.update(data.plot, { status: Plot.STATUS.BOOKED }, req);
    await createAuditLog({ req, entityType: "Booking", entityId: booking._id, action: AuditLog.ACTIONS.CREATE, changes: { after: booking } });
    await NotificationService.safeNotifyPermission("bookings:approve", {
      title: "New booking requires approval",
      message: `Booking for ${data.plot} is waiting for approval.`,
      relatedEntityType: "Booking",
      relatedEntityId: booking._id,
      eventType: "booking.created",
      eventKey: `booking-created:${booking._id}`,
    });
    return { booking: await enrichBooking(booking), preview };
  }

  static async getById(id) {
    const booking = await Booking.findById(id);
    if (!booking) throw new ApiError(404, "Booking not found");
    return enrichBooking(booking);
  }

  static async search({ search, status, page = 1, limit = 20 }) {
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 20;
    const skip = (numericPage - 1) * numericLimit;
    const text = search?.trim();

    const query = {};
    if (status) query.status = status;

    if (text) {
      const [members, plots] = await Promise.all([
        Member.find(
          {
            $or: [
              { name: { $regex: text, $options: "i" } },
              { memberId: { $regex: text, $options: "i" } },
            ],
          },
          { limit: 200, select: { _id: 1 } }
        ),
        Plot.find(
          {
            $or: [
              { plotNumber: { $regex: text, $options: "i" } },
              { fileNumber: { $regex: text, $options: "i" } },
            ],
          },
          { limit: 200, select: { _id: 1 } }
        ),
      ]);
      const memberIds = members.map((m) => m._id);
      const plotIds = plots.map((p) => p._id);
      if (!memberIds.length && !plotIds.length) {
        return { data: [], pagination: { page: numericPage, limit: numericLimit, total: 0, pages: 0 } };
      }
      const or = [];
      if (memberIds.length) or.push({ member: { $in: memberIds } });
      if (plotIds.length) or.push({ plot: { $in: plotIds } });
      query.$or = or;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query, { skip, limit: numericLimit, sort: { createdAt: -1 } }),
      db.collection(Booking.collectionName).countDocuments(query),
    ]);

    const memberIds = [...new Set(bookings.map((b) => b.member).filter(Boolean))];
    const plotIds = [...new Set(bookings.map((b) => b.plot).filter(Boolean))];
    const [members, plots] = await Promise.all([
      memberIds.length ? Member.find({ _id: { $in: memberIds } }) : [],
      plotIds.length ? Plot.find({ _id: { $in: plotIds } }) : [],
    ]);
    const memberMap = new Map(members.map((m) => [m._id, m]));
    const plotMap = new Map(plots.map((p) => [p._id, p]));

    const data = bookings.map((booking) => ({
      ...booking,
      memberRef: memberMap.get(booking.member) || null,
      plotRef: plotMap.get(booking.plot) || null,
    }));

    return {
      data,
      pagination: {
        page: numericPage,
        limit: numericLimit,
        total,
        pages: Math.ceil(total / numericLimit) || 0,
      },
    };
  }

  static async approve(id, data, req) {
    const booking = await Booking.findById(id);
    if (!booking) throw new ApiError(404, "Booking not found");
    if (booking.status !== Booking.STATUS.PENDING_APPROVAL) throw new ApiError(409, "Only pending bookings can be approved");
    const template = data.planTemplate || booking.planTemplate;
    const preview = await this.preview({ ...booking, planTemplate: template });
    await PlotService.update(booking.plot, { status: Plot.STATUS.ALLOTTED }, req);
    const updated = await Booking.update(id, { status: Booking.STATUS.CONFIRMED, approvedBy: req.user._id, planTemplate: template, approvedAt: new Date().toISOString() });
    const schedule = calculateInstallmentSchedule({ totalAmount: preview.netPayable, bookingAmount: booking.bookingAmount, numberOfInstallments: template.numberOfInstallments, frequency: template.frequency, firstDueDate: template.firstDueDate || new Date().toISOString() });
    const plan = await InstallmentPlan.create({ booking: id, totalAmount: schedule.totalAmount, numberOfInstallments: template.numberOfInstallments, frequency: template.frequency });
    const installments = await Installment.createMany(schedule.installments.map((item) => ({ plan: plan._id, member: booking.member, plot: booking.plot, dueDate: item.dueDate, amount: item.amount, penaltyAmount: 0, discountAmount: 0, paidAmount: 0, balance: item.amount, status: "Upcoming", overdueDays: 0 })));
    await InstallmentPlan.update(plan._id, { generatedInstallments: installments.map((item) => item._id) });
    await createAuditLog({ req, entityType: "Booking", entityId: id, action: AuditLog.ACTIONS.APPROVE, changes: { before: booking, after: updated }, meta: { installmentPlanId: plan._id } });
    const enriched = await enrichBooking(await Booking.findById(id));
    await NotificationService.safeNotifyMember(booking.member, {
      title: "Booking approved",
      message: "Your booking has been approved and the plot has been allotted.",
      relatedEntityType: "Booking",
      relatedEntityId: id,
      eventType: "booking.approved",
      eventKey: `booking-approved:${id}`,
    });
    return enriched;
  }

  static async reject(id, reason, req) {
    const booking = await Booking.findById(id);
    if (!booking) throw new ApiError(404, "Booking not found");
    if (booking.status !== Booking.STATUS.PENDING_APPROVAL) throw new ApiError(409, "Only pending bookings can be rejected");
    const updated = await Booking.update(id, { status: Booking.STATUS.CANCELLED, cancellationReason: reason, cancelledAt: new Date().toISOString() });
    await PlotService.update(booking.plot, { status: Plot.STATUS.AVAILABLE }, req);
    await createAuditLog({ req, entityType: "Booking", entityId: id, action: AuditLog.ACTIONS.REJECT, changes: { before: booking, after: updated } });
    await NotificationService.safeNotifyMember(booking.member, {
      title: "Booking rejected",
      message: `Your booking request was rejected: ${reason}`,
      relatedEntityType: "Booking",
      relatedEntityId: id,
      eventType: "booking.rejected",
      eventKey: `booking-rejected:${id}`,
    });
    return this.getById(id);
  }

  static async cancel(id, data, req) {
    const booking = await Booking.findById(id);
    if (!booking) throw new ApiError(404, "Booking not found");
    if (booking.status === Booking.STATUS.CANCELLED) throw new ApiError(409, "Booking is already cancelled");
    const updated = await Booking.update(id, { status: Booking.STATUS.CANCELLED, cancellationReason: data.reason, refundAmount: Number(data.refundAmount), cancelledAt: new Date().toISOString() });
    await PlotService.update(booking.plot, { status: Plot.STATUS.AVAILABLE }, req);
    await createAuditLog({ req, entityType: "Booking", entityId: id, action: AuditLog.ACTIONS.CANCEL, changes: { before: booking, after: updated }, meta: { policy: "Plot returns to Available; installment plan is retained for audit." } });
    await NotificationService.safeNotifyMember(booking.member, {
      title: "Booking cancelled",
      message: `Your booking was cancelled: ${data.reason}`,
      relatedEntityType: "Booking",
      relatedEntityId: id,
      eventType: "booking.cancelled",
      eventKey: `booking-cancelled:${id}`,
    });
    return this.getById(id);
  }
}

module.exports = BookingService;