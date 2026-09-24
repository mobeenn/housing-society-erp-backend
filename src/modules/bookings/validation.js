const { z } = require("zod");
const { Booking } = require("./booking.model");
const { FREQUENCIES } = require("./installmentCalculator");

const money = z.coerce.number().min(0);
const planTemplateSchema = z.object({
  numberOfInstallments: z.coerce.number().int().min(1).max(120),
  frequency: z.enum(Object.values(FREQUENCIES)),
  firstDueDate: z.string().optional(),
});

const createBookingSchema = z.object({
  member: z.string().min(1, "Member is required"),
  plot: z.string().min(1, "Plot is required"),
  bookingDate: z.string().optional(),
  price: money,
  discount: money.default(0),
  developmentCharges: money.default(0),
  additionalCharges: money.default(0),
  bookingAmount: money.default(0),
  planTemplate: planTemplateSchema,
});

const approveBookingSchema = z.object({ planTemplate: planTemplateSchema.optional() });
const rejectBookingSchema = z.object({ reason: z.string().min(3, "Rejection reason is required") });
const cancelBookingSchema = z.object({
  reason: z.string().min(3, "Cancellation reason is required"),
  refundAmount: money.default(0),
});

module.exports = { createBookingSchema, approveBookingSchema, rejectBookingSchema, cancelBookingSchema, BOOKING_STATUSES: Object.values(Booking.STATUS) };