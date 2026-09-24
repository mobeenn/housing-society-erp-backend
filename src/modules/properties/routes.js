const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { createPlotSchema, updatePlotSchema, updateStatusSchema } = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("plots", "view"), controller.getPlots);
router.get("/:id/history", authorize("plots", "view"), controller.getPlotHistory);
router.get("/:id", authorize("plots", "view"), controller.getPlotById);
router.post("/", authorize("plots", "create"), validate(createPlotSchema), controller.createPlot);
router.put("/:id", authorize("plots", "edit"), validate(updatePlotSchema), controller.updatePlot);
router.patch("/:id/status", authorize("plots", "edit"), validate(updateStatusSchema), controller.updatePlotStatus);
router.delete("/:id", authorize("plots", "delete"), controller.deletePlot);

module.exports = router;