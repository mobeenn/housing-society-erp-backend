const NoticeService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) => {
  const result = await NoticeService.listForUser(req.user, req.query);
  return ApiResponse.success(res, 200, "Notices retrieved", result);
};

exports.create = async (req, res) => {
  const notice = await NoticeService.create(req.body, req.user._id);
  return ApiResponse.success(res, 201, "Notice created", notice);
};

exports.update = async (req, res) => {
  const notice = await NoticeService.update(req.params.id, req.body);
  return ApiResponse.success(res, 200, "Notice updated", notice);
};

exports.publish = async (req, res) => {
  const notice = await NoticeService.publish(req.params.id);
  return ApiResponse.success(res, 200, "Notice published", notice);
};

exports.remove = async (req, res) => {
  await NoticeService.remove(req.params.id);
  return ApiResponse.success(res, 200, "Notice deleted");
};
