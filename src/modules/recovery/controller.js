const RecoveryService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.getConfig = async (_req, res) => ApiResponse.success(res, 200, "Recovery settings retrieved", await RecoveryService.getSettings());
exports.getPool = async (req, res) => ApiResponse.success(res, 200, "Recovery pool retrieved", await RecoveryService.listPool(req.query));
exports.assign = async (req, res) => ApiResponse.success(res, 201, "Recovery plots assigned", await RecoveryService.assign(req.body, req));
exports.reserve = async (req, res) => ApiResponse.success(res, 201, "Recovery plot reserved", await RecoveryService.reserve(req.params.id, req));
exports.reassign = async (req, res) => ApiResponse.success(res, 200, "Recovery assignment reassigned", await RecoveryService.reassign(req.params.id, req.body.agentId, req));
exports.resolve = async (req, res) => ApiResponse.success(res, 200, "Recovery assignment resolved", await RecoveryService.resolve(req.params.id, req));
exports.getMyPlots = async (req, res) => ApiResponse.success(res, 200, "Assigned recovery plots retrieved", await RecoveryService.listMyPlots(req.user, req.query));
exports.getAssignments = async (req, res) => ApiResponse.success(res, 200, "Recovery assignments retrieved", await RecoveryService.listAssignments(req.query));
exports.getAgents = async (_req, res) => ApiResponse.success(res, 200, "Recovery agents retrieved", await RecoveryService.getAgents());
exports.getCalls = async (req, res) => ApiResponse.success(res, 200, "Recovery call history retrieved", await RecoveryService.getCalls(req.params.id, req.user));
exports.addCall = async (req, res) => ApiResponse.success(res, 201, "Recovery call logged", await RecoveryService.addCall(req.params.id, req.body, req));
exports.getMyPerformance = async (req, res) => ApiResponse.success(res, 200, "Recovery performance retrieved", await RecoveryService.myPerformance(req.user));
exports.getTeamPerformance = async (_req, res) => ApiResponse.success(res, 200, "Team recovery performance retrieved", await RecoveryService.teamPerformance());
exports.getOverdue = async (req, res) => ApiResponse.success(res, 200, "Overdue installments retrieved", await RecoveryService.listOverdue(req.user, req.query));
exports.sendReminders = async (req, res) => ApiResponse.success(res, 200, "Recovery reminders queued", await RecoveryService.sendReminders(req.body.bookingIds, req));
exports.exportOverdue = async (req, res) => {
  const buffer = await RecoveryService.exportOverdue(req.user, req.query);
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .setHeader("Content-Disposition", "attachment; filename=recovery-overdue.xlsx")
    .send(Buffer.from(buffer));
};
exports.runAutoBlock = async (_req, res) => ApiResponse.success(res, 200, "Recovery auto-block check completed", await RecoveryService.runAutoBlockCheck({ force: true }));
