const ApprovalsService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.getPending = async (req, res) => {
  const data = await ApprovalsService.pending(req.user);
  return ApiResponse.success(res, 200, "Pending approvals", data);
};
