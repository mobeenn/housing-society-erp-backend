const { z } = require("zod");

const noticeObjectSchema = z.object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(3).max(5000),
    targetAudience: z.enum(["All", "Role-based", "Specific members"]),
    targetRoleIds: z.array(z.string()).default([]),
    targetMemberIds: z.array(z.string()).default([]),
    publishDate: z.string().datetime({ offset: true }).or(z.string().date()),
    expiryDate: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
    status: z.enum(["Draft", "Published"]).default("Draft"),
});

const baseNoticeSchema = noticeObjectSchema.superRefine((data, ctx) => {
    if (data.targetAudience === "Role-based" && data.targetRoleIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["targetRoleIds"], message: "Select at least one role" });
    }
    if (data.targetAudience === "Specific members" && data.targetMemberIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["targetMemberIds"], message: "Select at least one member" });
    }
    if (data.expiryDate && new Date(data.expiryDate) <= new Date(data.publishDate)) {
      ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "Expiry must be after publish date" });
    }
  });

const updateNoticeSchema = noticeObjectSchema.partial();

module.exports = { baseNoticeSchema, updateNoticeSchema };
