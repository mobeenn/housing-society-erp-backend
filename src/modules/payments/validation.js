const { z } = require("zod");
const { Payment, Refund } = require("./payment.model");
const createPaymentSchema = z.object({ member: z.string().min(1), plot: z.string().optional().nullable(), amount: z.coerce.number().positive(), method: z.enum(Payment.METHODS), remarks: z.string().optional().nullable() });
const previewPaymentSchema = createPaymentSchema.pick({ member: true, plot: true, amount: true });
const createRefundSchema = z.object({ payment: z.string().optional().nullable(), member: z.string().min(1), plot: z.string().optional().nullable(), amount: z.coerce.number().positive(), reason: z.string().min(3) });
module.exports = { createPaymentSchema, previewPaymentSchema, createRefundSchema, PAYMENT_STATUSES: Object.values(Payment.STATUS), REFUND_STATUSES: Object.values(Refund.STATUS) };