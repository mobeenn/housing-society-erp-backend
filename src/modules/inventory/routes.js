const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/low-stock", authorize("inventory", "view"), controller.lowStock);
router.get("/", authorize("inventory", "view"), controller.list);

module.exports = router;
