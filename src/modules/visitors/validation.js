const { z } = require("zod");
const { PASS_TYPES, PASS_STATUSES, BLACKLIST_ACTIONS } = require("./visitors.config");

const createVisitorEntrySchema = z.object({
  visitorName: z.string().min(2),
  phone: z.string().optional().nullable(),
  cnic: z.string().optional().nullable(),
  hostMember: z.string().optional().nullable(),
  purpose: z.string().optional(),
  gate: z.string().optional(),
  vehicleNumber: z.string().optional().nullable(),
  entryTime: z.string().optional(),
  remarks: z.string().optional().nullable(),
  passId: z.string().optional().nullable(),
});

const markExitSchema = z.object({
  exitTime: z.string().optional(),
  remarks: z.string().optional().nullable(),
});

const createPassSchema = z.object({
  passNumber: z.string().min(1),
  type: z.enum(PASS_TYPES),
  holderName: z.string().min(2),
  phone: z.string().optional().nullable(),
  cnic: z.string().optional().nullable(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validFrom must be YYYY-MM-DD"),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validTo must be YYYY-MM-DD"),
  relatedMember: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updatePassSchema = z.object({
  status: z.enum(PASS_STATUSES).optional(),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional().nullable(),
});

const createBlacklistEntrySchema = z.object({
  name: z.string().optional().nullable(),
  cnic: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  vehicleNumber: z.string().optional().nullable(),
  reason: z.string().min(3),
  action: z.enum(BLACKLIST_ACTIONS).optional(),
}).refine(
  (data) => data.name || data.cnic || data.phone || data.vehicleNumber,
  { message: "At least one identifier (name, cnic, phone, vehicleNumber) is required" }
);

const updateBlacklistEntrySchema = z.object({
  status: z.enum(["Active", "Inactive"]).optional(),
  reason: z.string().min(3).optional(),
  action: z.enum(BLACKLIST_ACTIONS).optional(),
});

module.exports = {
  createVisitorEntrySchema,
  markExitSchema,
  createPassSchema,
  updatePassSchema,
  createBlacklistEntrySchema,
  updateBlacklistEntrySchema,
};
