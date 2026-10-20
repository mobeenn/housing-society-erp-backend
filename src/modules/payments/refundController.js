const { PaymentService } = require("./service");
const ApiResponse = require("../../utils/apiResponse");
exports.listRefunds = async (req, res) =>
  ApiResponse.success(res, 200, await PaymentService.listRefunds(req.query));
exports.createRefund = async (req, res) => ApiResponse.success(res, 201, await PaymentService.createRefund(req.body, req), "Refund request created");
exports.approveRefund = async (req, res) => ApiResponse.success(res, 200, await PaymentService.updateRefund(req.params.id, "approve", req), "Refund approved");
exports.rejectRefund = async (req, res) => ApiResponse.success(res, 200, await PaymentService.updateRefund(req.params.id, "reject", req), "Refund rejected");
exports.payRefund = async (req, res) => ApiResponse.success(res, 200, await PaymentService.updateRefund(req.params.id, "pay", req), "Refund marked paid");