const express = require("express");
const controller = require("./controller");
const validate = require("../../middlewares/validate");
const { authenticate, authorize } = require("../../middlewares/auth");
const {
  createVisitorEntrySchema,
  markExitSchema,
  createPassSchema,
  updatePassSchema,
  createBlacklistEntrySchema,
  updateBlacklistEntrySchema,
} = require("./validation");

const router = express.Router();

router.use(authenticate);

// ==================== Security Reports ====================
router.get(
  "/reports/activity",
  authorize("visitors", "view"),
  controller.getActivityReport
);

// ==================== Visitor Entries ====================
router.get(
  "/entries",
  authorize("visitors", "view"),
  controller.listVisitorEntries
);

router.get(
  "/entries/:id",
  authorize("visitors", "view"),
  controller.getVisitorEntry
);

router.post(
  "/entries",
  authorize("visitors", "create"),
  validate(createVisitorEntrySchema),
  controller.createVisitorEntry
);

router.post(
  "/entries/:id/exit",
  authorize("visitors", "edit"),
  validate(markExitSchema),
  controller.markExit
);

// ==================== Passes ====================
router.get(
  "/passes",
  authorize("visitors", "view"),
  controller.listPasses
);

router.get(
  "/passes/:id",
  authorize("visitors", "view"),
  controller.getPass
);

router.post(
  "/passes",
  authorize("visitors", "create"),
  validate(createPassSchema),
  controller.createPass
);

router.patch(
  "/passes/:id",
  authorize("visitors", "edit"),
  validate(updatePassSchema),
  controller.updatePass
);

router.delete(
  "/passes/:id",
  authorize("visitors", "edit"),
  controller.deletePass
);

// ==================== Blacklist ====================
router.get(
  "/blacklist",
  authorize("visitors", "view"),
  controller.listBlacklist
);

router.get(
  "/blacklist/:id",
  authorize("visitors", "view"),
  controller.getBlacklistEntry
);

router.post(
  "/blacklist",
  authorize("visitors", "edit"),
  validate(createBlacklistEntrySchema),
  controller.createBlacklistEntry
);

router.patch(
  "/blacklist/:id",
  authorize("visitors", "edit"),
  validate(updateBlacklistEntrySchema),
  controller.updateBlacklistEntry
);

router.delete(
  "/blacklist/:id",
  authorize("visitors", "edit"),
  controller.deleteBlacklistEntry
);

module.exports = router;
