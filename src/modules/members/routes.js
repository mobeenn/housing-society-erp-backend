const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const {
  getMembers,
  getMemberById,
  getMember360,
  checkDuplicates,
  createMember,
  updateMember,
  updateMemberStatus,
  deleteMember,
  getStatistics,
  getMemberStatement,
} = require("./controller");
const {
  createMemberSchema,
  updateMemberSchema,
  updateStatusSchema,
  checkDuplicateSchema,
} = require("./validation");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ── Statistics ─────────────────────────────────────
router.get("/stats", authorize("members", "view"), getStatistics);
router.get("/:id/statement", authorize("payments", "view"), getMemberStatement);

// ── Check Duplicates ───────────────────────────────
router.post(
  "/check-duplicate",
  authorize("members", "view"), authorize("members", "create"),
  validate(checkDuplicateSchema),
  checkDuplicates
);

// ── Member 360 View ────────────────────────────────
router.get("/:id/360", authorize("members", "view"), getMember360);

// ── CRUD Operations ────────────────────────────────
router.get("/", authorize("members", "view"), getMembers);
router.get("/:id", authorize("members", "view"), getMemberById);
router.post("/", authorize("members", "create"), validate(createMemberSchema), createMember);
router.put("/:id", authorize("members", "edit"), validate(updateMemberSchema), updateMember);
router.patch(
  "/:id/status",
  authorize("members", "edit"),
  validate(updateStatusSchema),
  updateMemberStatus
);
router.delete("/:id", authorize("members", "delete"), deleteMember);

module.exports = router;
