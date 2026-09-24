const NotificationService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) => {
  const result = await NotificationService.listForUser(req.user._id, req.query);
  return ApiResponse.success(res, 200, "Notifications retrieved", result);
};

exports.markRead = async (req, res) => {
  const notification = await NotificationService.markRead(req.params.id, req.user._id);
  return ApiResponse.success(res, 200, "Notification marked as read", notification);
};

exports.markAllRead = async (req, res) => {
  const result = await NotificationService.markAllRead(req.user._id);
  return ApiResponse.success(res, 200, "All notifications marked as read", result);
};
