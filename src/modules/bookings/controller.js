const BookingService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.getBookings = async (req, res) => ApiResponse.success(res, 200, await BookingService.search(req.query));
exports.getBookingById = async (req, res) => ApiResponse.success(res, 200, await BookingService.getById(req.params.id));
exports.previewBooking = async (req, res) => ApiResponse.success(res, 200, await BookingService.preview(req.body));
exports.createBooking = async (req, res) => ApiResponse.success(res, 201, await BookingService.create(req.body, req), "Booking created successfully");
exports.approveBooking = async (req, res) => ApiResponse.success(res, 200, await BookingService.approve(req.params.id, req.body, req), "Booking approved successfully");
exports.rejectBooking = async (req, res) => ApiResponse.success(res, 200, await BookingService.reject(req.params.id, req.body.reason, req), "Booking rejected");
exports.cancelBooking = async (req, res) => ApiResponse.success(res, 200, await BookingService.cancel(req.params.id, req.body, req), "Booking cancelled");