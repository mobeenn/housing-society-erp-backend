const { z } = require("zod");

const nomineeSchema = z
  .object({
    name: z.string().min(1, "Nominee name is required").optional(),
    relation: z.string().min(1, "Nominee relation is required").optional(),
    cnic: z
      .string()
      .regex(/^\d{5}-\d{7}-\d{1}$/, "Invalid CNIC format (e.g., 12345-1234567-1)")
      .optional(),
  })
  .optional()
  .nullable();

const createMemberSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    cnic: z
      .string()
      .regex(/^\d{5}-\d{7}-\d{1}$/, "Invalid CNIC format (e.g., 12345-1234567-1)"),
    phone: z.string().optional().nullable(),
    email: z.string().email("Invalid email format").optional().nullable(),
    address: z.string().optional().nullable(),
    userId: z.string().optional().nullable(),
    nominee: nomineeSchema,
    status: z
      .enum(["Active", "Inactive", "Blacklisted"])
      .optional()
      .default("Active"),
    photo: z.string().url("Photo must be a valid URL").optional().nullable(),
    documents: z.array(z.string().url()).optional().default([]),
});

const updateMemberSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    cnic: z
      .string()
      .regex(/^\d{5}-\d{7}-\d{1}$/, "Invalid CNIC format (e.g., 12345-1234567-1)")
      .optional(),
    phone: z.string().optional().nullable(),
    email: z.string().email("Invalid email format").optional().nullable(),
    address: z.string().optional().nullable(),
    userId: z.string().optional().nullable(),
    nominee: nomineeSchema,
    status: z.enum(["Active", "Inactive", "Blacklisted"]).optional(),
    photo: z.string().url("Photo must be a valid URL").optional().nullable(),
    documents: z.array(z.string().url()).optional(),
});

const updateStatusSchema = z.object({
    status: z.enum(["Active", "Inactive", "Blacklisted"], {
      required_error: "Status is required",
    }),
});

const checkDuplicateSchema = z.object({
    cnic: z.string().optional(),
    phone: z.string().optional(),
    excludeId: z.string().optional().nullable(),
});

module.exports = {
  createMemberSchema,
  updateMemberSchema,
  updateStatusSchema,
  checkDuplicateSchema,
};
