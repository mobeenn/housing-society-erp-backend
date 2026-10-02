const { z } = require("zod");

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  email: z.string().email("Invalid email address").toLowerCase(),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleId: z.string().min(1, "Role is required"),
  mustResetPassword: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").trim().optional(),
  email: z.string().email("Invalid email address").toLowerCase().optional(),
  phone: z.string().optional(),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
  mustResetPassword: z.boolean().optional(),
});

/**
 * Query params arrive as strings, so page/limit must be coerced before they
 * reach Prisma — `take: "20"` raises PrismaClientValidationError (Int expected).
 * sortBy is allow-listed so an unknown column returns 400 instead of a 500.
 */
const USER_SORT_FIELDS = [
  "name",
  "email",
  "isActive",
  "createdAt",
  "updatedAt",
  "lastLoginAt",
];

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional().default(""),
  sortBy: z.enum(USER_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  roleId: z.string().min(1).optional(),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
  USER_SORT_FIELDS,
};
