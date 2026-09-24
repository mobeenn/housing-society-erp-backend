const { z } = require("zod");
const { CONFIRMATION_TEXT } = require("../lifecycle/confirmation");

const adjustedAmountSchema = z.object({
  plot: z.string().min(1),
  amount: z.coerce.number().finite().nonnegative(),
  reason: z.string().max(500).optional().default(""),
});

const executeMergeSchema = z.object({
  mergedPlots: z.array(z.string().min(1)).min(2),
  resultingPlot: z.string().min(1),
  adjustedAmounts: z.array(adjustedAmountSchema).default([]),
  confirmationText: z.literal(CONFIRMATION_TEXT.PLOT_MERGE),
});

module.exports = { adjustedAmountSchema, executeMergeSchema };
