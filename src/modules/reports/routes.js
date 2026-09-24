const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const controller = require("./controller");

const router = express.Router();

router.use(authenticate);
router.get("/catalog", authorize("reports", "view"), controller.getCatalog);
router.get("/dashboard", authorize("reports", "view"), controller.getDashboard);
router.get("/:type", authorize("reports", "view"), controller.getReport);

module.exports = router;
