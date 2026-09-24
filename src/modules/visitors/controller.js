const {
  VisitorEntryService,
  PassService,
  BlacklistService,
  SecurityReportsService,
} = require("./service");
const ApiResponse = require("../../utils/apiResponse");

// ==================== Visitor Entries ====================

exports.listVisitorEntries = async (req, res) =>
  ApiResponse.success(res, 200, await VisitorEntryService.list(req.query));

exports.getVisitorEntry = async (req, res) =>
  ApiResponse.success(res, 200, await VisitorEntryService.get(req.params.id));

exports.createVisitorEntry = async (req, res) => {
  const result = await VisitorEntryService.create(req.body, req);
  const message = result.blacklistWarning
    ? `Visitor entry created. WARNING: ${result.blacklistWarning}`
    : "Visitor entry created";
  return ApiResponse.success(res, 201, result, message);
};

exports.markExit = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await VisitorEntryService.markExit(req.params.id, req.body, req),
    "Exit marked"
  );

// ==================== Passes ====================

exports.listPasses = async (req, res) =>
  ApiResponse.success(res, 200, await PassService.list(req.query));

exports.getPass = async (req, res) =>
  ApiResponse.success(res, 200, await PassService.get(req.params.id));

exports.createPass = async (req, res) =>
  ApiResponse.success(res, 201, await PassService.create(req.body, req), "Pass created");

exports.updatePass = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await PassService.update(req.params.id, req.body, req),
    "Pass updated"
  );

exports.deletePass = async (req, res) =>
  ApiResponse.success(res, 200, await PassService.delete(req.params.id, req), "Pass deleted");

// ==================== Blacklist ====================

exports.listBlacklist = async (req, res) =>
  ApiResponse.success(res, 200, await BlacklistService.list(req.query));

exports.getBlacklistEntry = async (req, res) =>
  ApiResponse.success(res, 200, await BlacklistService.get(req.params.id));

exports.createBlacklistEntry = async (req, res) =>
  ApiResponse.success(
    res,
    201,
    await BlacklistService.create(req.body, req),
    "Blacklist entry created"
  );

exports.updateBlacklistEntry = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await BlacklistService.update(req.params.id, req.body, req),
    "Blacklist entry updated"
  );

exports.deleteBlacklistEntry = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await BlacklistService.delete(req.params.id, req),
    "Blacklist entry deleted"
  );

// ==================== Security Reports ====================

exports.getActivityReport = async (req, res) =>
  ApiResponse.success(res, 200, await SecurityReportsService.getActivityReport(req.query));
