const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const {
  createVehicleSchema,
  updateVehicleSchema,
  issueStickerSchema,
  updateStatusSchema,
} = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("security-vehicles", "view"), controller.list);
router.post(
  "/",
  authorize("security-vehicles", "create"),
  validate(createVehicleSchema),
  controller.create
);
router.get("/:id", authorize("security-vehicles", "view"), controller.get);
router.patch(
  "/:id",
  authorize("security-vehicles", "edit"),
  validate(updateVehicleSchema),
  controller.update
);
router.delete("/:id", authorize("security-vehicles", "delete"), controller.delete);
router.post(
  "/:id/sticker",
  authorize("security-vehicles", "edit"),
  validate(issueStickerSchema),
  controller.issueSticker
);
router.patch(
  "/:id/status",
  authorize("security-vehicles", "edit"),
  validate(updateStatusSchema),
  controller.updateStatus
);

module.exports = router;
