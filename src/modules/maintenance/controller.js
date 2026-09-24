const { AssetService, WorkOrderService } = require("./service");
const ApiResponse = require("../../utils/apiResponse");

// ── Assets ──────────────────────────────────────────────
exports.listAssets = async (req, res) => ApiResponse.success(res, 200, await AssetService.list(req.query));
exports.getAsset = async (req, res) => ApiResponse.success(res, 200, await AssetService.get(req.params.id));
exports.createAsset = async (req, res) => ApiResponse.success(res, 201, await AssetService.create(req.body, req), "Asset registered");
exports.updateAsset = async (req, res) => ApiResponse.success(res, 200, await AssetService.update(req.params.id, req.body, req), "Asset updated");
exports.assetHistory = async (req, res) => ApiResponse.success(res, 200, await AssetService.history(req.params.id));

// ── Work orders ────────────────────────────────────────
exports.list = async (req, res) => ApiResponse.success(res, 200, await WorkOrderService.list(req.query));
exports.get = async (req, res) => ApiResponse.success(res, 200, await WorkOrderService.get(req.params.id));
exports.create = async (req, res) => ApiResponse.success(res, 201, await WorkOrderService.create(req.body, req), "Work order created");
exports.update = async (req, res) => ApiResponse.success(res, 200, await WorkOrderService.update(req.params.id, req.body, req), "Work order updated");
exports.logProgress = async (req, res) => ApiResponse.success(res, 201, await WorkOrderService.logProgress(req.params.id, req.body, req), "Progress logged");
exports.changeStatus = async (req, res) => ApiResponse.success(res, 200, await WorkOrderService.changeStatus(req.params.id, req.body, req), "Work order status updated");
exports.complete = async (req, res) => ApiResponse.success(res, 200, await WorkOrderService.complete(req.params.id, req.body, req), "Work order completed");
exports.cancel = async (req, res) => ApiResponse.success(res, 200, await WorkOrderService.cancel(req.params.id, req.body, req), "Work order cancelled");