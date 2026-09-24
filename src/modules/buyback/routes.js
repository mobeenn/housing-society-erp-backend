const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { executeBuybackSchema } = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("buyback", "view"), controller.list);
router.get("/eligible-bookings", authorize("buyback", "view"), controller.eligibleBookings);
router.post("/execute", authorize("buyback", "create"), validate(executeBuybackSchema), controller.execute);
router.get("/:id/invoice.pdf", authorize("buyback", "view"), controller.invoice);
router.get("/:id/invoice", authorize("buyback", "view"), controller.invoice);
router.get("/:id", authorize("buyback", "view"), controller.get);

module.exports = router;
