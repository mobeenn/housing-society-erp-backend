const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const {
  createGuardSchema,
  updateGuardSchema,
  assignRosterSchema,
  attendanceSchema,
} = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

// ==================== Guards ====================
router.get("/guards", authorize("security-guards", "view"), controller.listGuards);
router.post(
  "/guards",
  authorize("security-guards", "create"),
  validate(createGuardSchema),
  controller.createGuard
);
router.get("/guards/:id", authorize("security-guards", "view"), controller.getGuard);
router.patch(
  "/guards/:id",
  authorize("security-guards", "edit"),
  validate(updateGuardSchema),
  controller.updateGuard
);

// ==================== Duty Roster ====================
router.get("/roster", authorize("security-guards", "view"), controller.listRoster);
router.post(
  "/roster/assign",
  authorize("security-guards", "edit"),
  validate(assignRosterSchema),
  controller.assignRoster
);
router.post(
  "/roster/attendance",
  authorize("security-guards", "edit"),
  validate(attendanceSchema),
  controller.markAttendance
);

module.exports = router;
