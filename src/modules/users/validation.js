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

module.exports = {
  createUserSchema,
  updateUserSchema,
};
