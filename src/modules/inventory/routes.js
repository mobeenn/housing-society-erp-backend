const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { createItemSchema, updateItemSchema, adjustStockSchema } = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/low-stock", authorize("inventory", "view"), controller.lowStock);
router.get("/", authorize("inventory", "view"), controller.list);
router.post("/", authorize("inventory", "create"), validate(createItemSchema), controller.create);
router.get("/:id", authorize("inventory", "view"), controller.get);
router.get("/:id/history", authorize("inventory", "view"), controller.history);
router.put("/:id", authorize("inventory", "edit"), validate(updateItemSchema), controller.update);
router.post("/:id/adjust", authorize("inventory", "edit"), validate(adjustStockSchema), controller.adjust);

module.exports = router;
