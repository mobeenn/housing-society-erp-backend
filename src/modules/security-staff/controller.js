const { GuardService, RosterService } = require("./service");
const ApiResponse = require("../../utils/apiResponse");

// ==================== Guards ====================

exports.listGuards = async (req, res) =>
  ApiResponse.success(res, 200, await GuardService.list(req.query));

exports.getGuard = async (req, res) =>
  ApiResponse.success(res, 200, await GuardService.get(req.params.id));

exports.createGuard = async (req, res) =>
  ApiResponse.success(
    res,
    201,
    await GuardService.create(req.body, req),
    "Guard created"
  );

exports.updateGuard = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await GuardService.update(req.params.id, req.body, req),
    "Guard updated"
  );

// ==================== Duty Roster ====================

exports.listRoster = async (req, res) =>
  ApiResponse.success(res, 200, await RosterService.list(req.query));

exports.assignRoster = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await RosterService.assign(req.body, req),
    "Shift assigned"
  );

exports.markAttendance = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await RosterService.markAttendance(req.body, req),
    "Attendance marked"
  );
