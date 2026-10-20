const { z } = require("zod");

const createItemSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).optional(),
  unit: z.string().trim().max(40).optional(),
  quantity: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

const updateItemSchema = createItemSchema.partial();

const adjustStockSchema = z.object({
  type: z.enum(["IN", "OUT", "ADJUST"]),
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().min(1).max(500),
});

module.exports = { createItemSchema, updateItemSchema, adjustStockSchema };
