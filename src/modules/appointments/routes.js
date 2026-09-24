const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { createAppointmentSchema, listAppointmentsSchema } = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/today", authorize("appointments", "view"), controller.today);
router.get("/hosts", authorize("appointments", "view"), controller.hosts);
router.get("/", authorize("appointments", "view"), validate(listAppointmentsSchema, "query"), controller.list);
router.post("/", authorize("appointments", "create"), validate(createAppointmentSchema), controller.create);
router.get("/:id", authorize("appointments", "view"), controller.get);
router.post("/:id/check-in", authorize("appointments", "edit"), controller.checkIn);
router.post("/:id/check-out", authorize("appointments", "edit"), controller.checkOut);

module.exports = router;
