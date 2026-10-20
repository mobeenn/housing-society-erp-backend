const express = require("express");
const multer = require("multer");
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
  getSetupStatus,
  memberImportTemplate,
  plotImportTemplate,
  previewMemberImport,
  previewPlotImport,
  commitMemberImport,
  commitPlotImport,
} = require("./controller");

const router = express.Router();
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

// All routes require authentication
router.use(authenticate);

// ── Society Settings ──────────────────────────────
router.get("/settings", getSocietySettings);
router.put("/settings", authorize("settings", "edit"), updateSocietySettings);
router.get("/setup-status", authorize("settings", "view"), getSetupStatus);

// ── CSV import (members / plots) ──────────────────
router.get("/import/members/template.csv", authorize("members", "create"), memberImportTemplate);
router.get("/import/plots/template.csv", authorize("plots", "create"), plotImportTemplate);
router.post(
  "/import/members/preview",
  authorize("members", "create"),
  csvUpload.single("file"),
  previewMemberImport
);
router.post(
  "/import/plots/preview",
  authorize("plots", "create"),
  csvUpload.single("file"),
  previewPlotImport
);
router.post("/import/members/commit", authorize("members", "create"), commitMemberImport);
router.post("/import/plots/commit", authorize("plots", "create"), commitPlotImport);

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
