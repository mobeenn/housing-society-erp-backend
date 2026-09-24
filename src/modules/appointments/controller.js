const AppointmentService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) => ApiResponse.success(res, 200, "Appointments retrieved", await AppointmentService.list(req.query));
exports.today = async (_req, res) => ApiResponse.success(res, 200, "Today's appointments retrieved", await AppointmentService.today());
exports.hosts = async (_req, res) => ApiResponse.success(res, 200, "Appointment hosts retrieved", await AppointmentService.hosts());
exports.create = async (req, res) => ApiResponse.success(res, 201, "Walk-in appointment created", await AppointmentService.create(req.body, req));
exports.get = async (req, res) => ApiResponse.success(res, 200, "Appointment retrieved", await AppointmentService.get(req.params.id));
exports.checkIn = async (req, res) => ApiResponse.success(res, 200, "Appointment checked in", await AppointmentService.checkIn(req.params.id, req));
exports.checkOut = async (req, res) => ApiResponse.success(res, 200, "Appointment checked out", await AppointmentService.checkOut(req.params.id, req));
