const ComplaintService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) => ApiResponse.success(res, 200, await ComplaintService.list(req.query));
exports.get = async (req, res) => ApiResponse.success(res, 200, await ComplaintService.get(req.params.id));
exports.create = async (req, res) => ApiResponse.success(res, 201, await ComplaintService.create(req.body, req), "Complaint filed");
exports.assign = async (req, res) => ApiResponse.success(res, 200, await ComplaintService.assign(req.params.id, req.body, req), "Complaint assigned");
exports.addComment = async (req, res) => ApiResponse.success(res, 201, await ComplaintService.addComment(req.params.id, req.body, req), "Comment added");
exports.changeStatus = async (req, res) => ApiResponse.success(res, 200, await ComplaintService.changeStatus(req.params.id, req.body, req), "Complaint status updated");
exports.resolve = async (req, res) => ApiResponse.success(res, 200, await ComplaintService.resolve(req.params.id, req.body, req), "Complaint resolved");
exports.reopen = async (req, res) => ApiResponse.success(res, 200, await ComplaintService.reopen(req.params.id, req), "Complaint reopened");