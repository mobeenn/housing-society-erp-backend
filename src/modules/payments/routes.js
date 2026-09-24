const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { createPaymentSchema, previewPaymentSchema, createRefundSchema } = require("./validation");
const controller = require("./controller");
const refunds = require("./refundController");

const paymentRouter = express.Router();
paymentRouter.use(authenticate);
paymentRouter.get("/", authorize("payments", "view"), controller.getPayments);
paymentRouter.post("/preview", authorize("payments", "view"), authorize("payments", "create"), validate(previewPaymentSchema), controller.previewPayment);
paymentRouter.post("/", authorize("payments", "create"), validate(createPaymentSchema), controller.createPayment);
paymentRouter.get("/:id/receipt.pdf", authorize("payments", "view"), controller.getReceipt);
paymentRouter.get("/:id", authorize("payments", "view"), controller.getPayment);

const refundRouter = express.Router();
refundRouter.use(authenticate);
refundRouter.get("/", authorize("refunds", "view"), refunds.listRefunds);
refundRouter.post("/", authorize("refunds", "create"), validate(createRefundSchema), refunds.createRefund);
refundRouter.post("/:id/approve", authorize("refunds", "approve"), refunds.approveRefund);
refundRouter.post("/:id/reject", authorize("refunds", "reject"), refunds.rejectRefund);
refundRouter.post("/:id/pay", authorize("refunds", "refund"), refunds.payRefund);

module.exports = { paymentRouter, refundRouter };