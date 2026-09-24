const { z } = require("zod");

const documentMetadataSchema = z.object({
  relatedEntityType: z.string().min(2).max(50),
  relatedEntityId: z.string().min(1),
  type: z.string().min(1).max(100),
  number: z.string().max(100).optional().nullable(),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

module.exports = { documentMetadataSchema };