const { z } = require("zod");
const createTransferSchema = z.object({ plot: z.string().min(1), fromMember: z.string().min(1), toMember: z.string().min(1), type: z.string().min(1), documents: z.array(z.string()).optional().default([]), transferFee: z.coerce.number().min(0).default(0) });
module.exports = { createTransferSchema };