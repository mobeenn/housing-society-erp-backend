const { z } = require("zod");
const { ConstructionApplication } = require("./construction.model");
const createApplicationSchema = z.object({ member: z.string().min(1), plot: z.string().min(1), applicationType: z.string().min(1), documents: z.array(z.string()).optional().default([]), fees: z.coerce.number().min(0).default(0) });
const inspectionSchema = z.object({ date: z.string().optional(), findings: z.string().min(1), violations: z.array(z.string()).optional().default([]), correctiveActionsRequired: z.coerce.boolean().default(false), reinspectionRequired: z.coerce.boolean().default(false), reinspectionDate: z.string().optional().nullable() });
module.exports = { createApplicationSchema, inspectionSchema, CONSTRUCTION_STATUSES: Object.values(ConstructionApplication.STATUS) };