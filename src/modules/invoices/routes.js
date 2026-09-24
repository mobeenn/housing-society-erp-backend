const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("invoices", "view"), controller.list);
router.get("/:id", authorize("invoices", "view"), controller.get);
router.delete("/:id", authorize("invoices", "delete"), controller.cancel);

module.exports = router;
