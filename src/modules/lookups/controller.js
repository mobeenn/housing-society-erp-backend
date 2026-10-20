const LookupService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.searchMembers = async (req, res) => {
  const data = await LookupService.searchMembers(req.user, {
    q: req.query.q,
    limit: req.query.limit,
  });
  ApiResponse.success(res, 200, data);
};

exports.searchPlots = async (req, res) => {
  const data = await LookupService.searchPlots(req.user, {
    q: req.query.q,
    limit: req.query.limit,
  });
  ApiResponse.success(res, 200, data);
};
