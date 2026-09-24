const SearchService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.search = async (req, res) => {
  const result = await SearchService.search(req.query.q, req.query.limit);
  return ApiResponse.success(res, 200, "Search results", result);
};
