const { z } = require("zod");

/**
 * Validation schemas for Administration module
 */
const societySettingsSchema = z.object({
  name: z.string().min(2, "Society name must be at least 2 characters"),
  logo: z.string().url("Must be a valid URL").optional().nullable(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  fiscalYear: z.object({
    startMonth: z.number().min(1).max(12),
    startDay: z.number().min(1).max(31),
  }).optional(),
  currency: z.string().min(1).max(5).default("PKR"),
  recoveryAutoBlockThreshold: z.coerce.number().min(0).max(100).default(49),
  recoveryAllowSelfReserve: z.boolean().default(false),
  feeSettings: z.object({
    lateFeePercentage: z.number().min(0).max(100).default(0),
    lateFeeDaysGrace: z.number().min(0).default(0),
    penaltyRule: z.object({
      type: z.enum(["flat", "percentage"]),
      amount: z.coerce.number().min(0),
      period: z.enum(["day", "month"]),
      graceDays: z.coerce.number().min(0),
    }).optional(),
  }).optional(),
  contactInfo: z.object({
    phone: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    website: z.string().url("Invalid URL").optional().or(z.literal("")),
  }).optional(),
});

const numberingRuleSchema = z.object({
  prefix: z.string().min(1, "Prefix is required").max(10),
  padLength: z.number().min(3).max(10),
  resetPolicy: z.enum(["never", "daily", "yearly", "monthly"]),
});

const masterDataSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  societySettingsSchema,
  numberingRuleSchema,
  masterDataSchema,
};
