const { z } = require("zod");
const utilities = z.object({ electricity: z.string().optional().nullable(), gas: z.string().optional().nullable(), water: z.string().optional().nullable() }).optional().default({});
const createPossessionSchema = z.object({ member: z.string().min(1), plot: z.string().min(1), possessionCharges: z.coerce.number().min(0), utilities });
module.exports = { createPossessionSchema };