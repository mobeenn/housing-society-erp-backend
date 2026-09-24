const { z } = require("zod");

const createRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters").max(50),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).default([]),
});

const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).optional(),
});

module.exports = {
  createRoleSchema,
  updateRoleSchema,
};
