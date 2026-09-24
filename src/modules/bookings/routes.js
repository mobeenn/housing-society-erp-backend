const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { createBookingSchema, approveBookingSchema, rejectBookingSchema, cancelBookingSchema } = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/", authorize("bookings", "view"), controller.getBookings);
router.post("/preview", authorize("bookings", "view"), authorize("bookings", "create"), validate(createBookingSchema), controller.previewBooking);
router.get("/:id", authorize("bookings", "view"), controller.getBookingById);
router.post("/", authorize("bookings", "create"), validate(createBookingSchema), controller.createBooking);
router.post("/:id/approve", authorize("bookings", "approve"), validate(approveBookingSchema), controller.approveBooking);
router.post("/:id/reject", authorize("bookings", "reject"), validate(rejectBookingSchema), controller.rejectBooking);
router.post("/:id/cancel", authorize("bookings", "cancel"), validate(cancelBookingSchema), controller.cancelBooking);

module.exports = router;