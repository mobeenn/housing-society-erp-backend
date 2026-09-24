const { z } = require("zod");
const NocApplication = require("./noc.model");
const createNocSchema = z.object({ member: z.string().min(1), plot: z.string().min(1), nocType: z.string().min(1), feeAmount: z.coerce.number().min(0).default(0), documents: z.array(z.string()).optional().default([]) });
module.exports = { createNocSchema, NOC_STATUSES: Object.values(NocApplication.STATUS) };