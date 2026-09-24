const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const {
  assignRecoverySchema,
  addCallSchema,
} = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/config", authorize("recovery", "view"), controller.getConfig);
router.get("/pool", authorize("recovery", "view"), controller.getPool);
router.get("/overdue", authorize("recovery", "view"), controller.getOverdue);
router.get("/overdue-installments", authorize("recovery", "view"), controller.getOverdue);
router.get("/overdue/export", authorize("recovery", "export"), controller.exportOverdue);
router.get("/overdue-installments/export", authorize("recovery", "export"), controller.exportOverdue);
router.post("/reminders", authorize("recovery", "edit"), controller.sendReminders);
router.get("/my-plots", authorize("recovery", "view"), controller.getMyPlots);
router.get("/my-performance", authorize("recovery", "view"), controller.getMyPerformance);
router.get("/team-performance", authorize("recovery", "create"), controller.getTeamPerformance);
router.get("/assignments", authorize("recovery", "create"), controller.getAssignments);
router.get("/agents", authorize("recovery", "create"), controller.getAgents);
router.post("/assign", authorize("recovery", "create"), validate(assignRecoverySchema), controller.assign);
router.post("/auto-block/run", authorize("recovery", "create"), controller.runAutoBlock);

router.post("/:id/reserve", authorize("recovery", "edit"), controller.reserve);
router.post("/:id/reassign", authorize("recovery", "edit"), controller.reassign);
router.post("/:id/resolve", authorize("recovery", "edit"), controller.resolve);
router.post("/:id/calls", authorize("recovery", "edit"), validate(addCallSchema), controller.addCall);
router.get("/:id/calls", authorize("recovery", "view"), controller.getCalls);

module.exports = router;
