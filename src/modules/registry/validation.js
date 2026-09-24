const { z } = require("zod");

const createRegistryBatchSchema = z.object({
  plots: z.array(z.string().min(1)).min(1),
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  remarks: z.string().max(1000).optional().nullable(),
});

const completeRegistryBatchSchema = z.object({
  remarks: z.string().max(1000).optional().nullable(),
});

module.exports = { createRegistryBatchSchema, completeRegistryBatchSchema };
