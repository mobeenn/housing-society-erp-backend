const { z } = require("zod");
const BuyBack = require("./buyback.model");
const { CONFIRMATION_TEXT } = require("../lifecycle/confirmation");

const executeBuybackSchema = z.object({
  booking: z.string().min(1),
  type: z.enum(Object.values(BuyBack.TYPE)),
  paymentType: z.enum(["Cash", "Adjustment", "Online"]),
  deductionPercent: z.coerce.number().finite().min(0).max(100).default(0),
  settlementAmount: z.coerce.number().finite().nonnegative(),
  remarks: z.string().max(1000).optional().default(""),
  confirmationText: z.string().min(1),
}).superRefine((value, context) => {
  const expected = value.type === BuyBack.TYPE.CANCEL ? CONFIRMATION_TEXT.CANCEL : CONFIRMATION_TEXT.BUYBACK;
  if (value.confirmationText !== expected) {
    context.addIssue({ code: "custom", path: ["confirmationText"], message: `Confirmation must exactly match ${expected}` });
  }
});

module.exports = { executeBuybackSchema };
