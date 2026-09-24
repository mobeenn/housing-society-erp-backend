const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/:type", authorize("dashboards", "view"), controller.get);

module.exports = router;
