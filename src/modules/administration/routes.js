const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const {
  getSocietySettings,
  updateSocietySettings,
  getNumberingRules,
  updateNumberingRule,
  getMasterData,
  createMasterData,
  updateMasterData,
  archiveMasterData,
  restoreMasterData,
  getAuditLogs,
} = require("./controller");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ── Society Settings ──────────────────────────────
router.get("/settings", getSocietySettings);
router.put("/settings", authorize("settings", "edit"), updateSocietySettings);

// ── Numbering Rules ───────────────────────────────
router.get("/numbering-rules", getNumberingRules);
router.put("/numbering-rules/:id", authorize("settings", "edit"), updateNumberingRule);

// ── Master Data (Generic CRUD) ────────────────────
router.get("/master-data/:type", getMasterData);
router.post("/master-data/:type", authorize("settings", "edit"), createMasterData);
router.put("/master-data/:type/:id", authorize("settings", "edit"), updateMasterData);
router.patch("/master-data/:type/:id/archive", authorize("settings", "edit"), archiveMasterData);
router.patch("/master-data/:type/:id/restore", authorize("settings", "edit"), restoreMasterData);

// ── Audit Logs ────────────────────────────────────
router.get("/audit-logs", authorize("audit", "view"), getAuditLogs);

module.exports = router;
