const { z } = require("zod");
const { PRIORITIES, CATEGORY_KEYS, STATUSES } = require("./complaint.config");

const createComplaintSchema = z.object({
  member: z.string().min(1),
  plot: z.string().nullable().optional(),
  category: z.enum(CATEGORY_KEYS),
  description: z.string().min(3),
  location: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES),
  attachments: z.array(z.string()).optional().default([]),
});

const assignSchema = z.object({
  assignedDepartment: z.string().min(1).optional(),
  assignedStaff: z.string().min(1).nullable().optional(),
});

const commentSchema = z.object({
  text: z.string().min(1),
});

const statusSchema = z.object({
  status: z.enum(Object.values(STATUSES)),
});

const resolveSchema = z.object({
  resolutionNote: z.string().min(3),
});

module.exports = {
  createComplaintSchema,
  assignSchema,
  commentSchema,
  statusSchema,
  resolveSchema,
  COMPLAINT_STATUSES: Object.values(STATUSES),
};