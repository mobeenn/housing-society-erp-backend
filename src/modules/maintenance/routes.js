const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const {
  createAssetSchema,
  updateAssetSchema,
  createWorkOrderSchema,
  updateWorkOrderSchema,
  progressSchema,
  statusSchema,
  completeSchema,
  cancelSchema,
} = require("./validation");
const controller = require("./controller");

// ── Asset registry routes (/api/assets) ─────────────────
const assetRouter = express.Router();
assetRouter.use(authenticate);

assetRouter.get("/", authorize("assets", "view"), controller.listAssets);
assetRouter.post("/", authorize("assets", "create"), validate(createAssetSchema), controller.createAsset);
assetRouter.get("/:id", authorize("assets", "view"), controller.getAsset);
assetRouter.put("/:id", authorize("assets", "edit"), validate(updateAssetSchema), controller.updateAsset);
// Full maintenance history for an asset (SRS Section 17)
assetRouter.get("/:id/history", authorize("assets", "view"), controller.assetHistory);

// ── Work order routes (/api/work-orders) ────────────────
const workOrderRouter = express.Router();
workOrderRouter.use(authenticate);

workOrderRouter.get("/", authorize("maintenance", "view"), controller.list);
workOrderRouter.post("/", authorize("maintenance", "create"), validate(createWorkOrderSchema), controller.create);
workOrderRouter.get("/:id", authorize("maintenance", "view"), controller.get);
workOrderRouter.put("/:id", authorize("maintenance", "edit"), validate(updateWorkOrderSchema), controller.update);
workOrderRouter.post("/:id/progress", authorize("maintenance", "edit"), validate(progressSchema), controller.logProgress);
workOrderRouter.post("/:id/status", authorize("maintenance", "edit"), validate(statusSchema), controller.changeStatus);
workOrderRouter.post("/:id/complete", authorize("maintenance", "edit"), validate(completeSchema), controller.complete);
workOrderRouter.post("/:id/cancel", authorize("maintenance", "cancel"), validate(cancelSchema), controller.cancel);

module.exports = { assetRouter, workOrderRouter };