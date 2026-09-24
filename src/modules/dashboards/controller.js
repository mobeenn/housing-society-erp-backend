const DashboardService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.get = async (req, res) => {
  const dashboard = await DashboardService.get(req.params.type);
  return ApiResponse.success(res, 200, "Dashboard data retrieved", dashboard);
};
