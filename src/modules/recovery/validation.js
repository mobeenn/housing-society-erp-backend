const { z } = require("zod");
const { RecoveryCall } = require("./recovery.model");

const dateString = z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

const assignRecoverySchema = z.object({
  agentId: z.string().min(1, "Agent is required").optional(),
  agent: z.string().min(1).optional(),
  bookingIds: z.array(z.string().min(1)).min(1).optional(),
  bookingId: z.string().min(1).optional(),
}).refine((value) => Boolean(value.agentId || value.agent), {
  message: "Agent is required",
}).refine((value) => Boolean(value.bookingIds?.length || value.bookingId), {
  message: "At least one booking is required",
});

const addCallSchema = z.object({
  outcome: z.enum(RecoveryCall.OUTCOMES),
  notes: z.string().max(2000).optional().default(""),
  callDate: dateString.optional(),
  commitmentDate: dateString.nullable().optional(),
  commitmentAmount: z.union([z.coerce.number().min(0), z.null()]).optional(),
});

const statusSchema = z.object({
  status: z.enum(["Assigned", "InProgress", "Resolved", "Reassigned"]),
});

module.exports = {
  assignRecoverySchema,
  addCallSchema,
  statusSchema,
};
