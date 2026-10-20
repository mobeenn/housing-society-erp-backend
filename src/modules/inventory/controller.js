const InventoryService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) =>
  ApiResponse.success(res, 200, "Inventory retrieved", await InventoryService.list(req.query));

exports.lowStock = async (_req, res) =>
  ApiResponse.success(res, 200, "Low-stock inventory retrieved", await InventoryService.lowStock());

exports.get = async (req, res) =>
  ApiResponse.success(res, 200, "Inventory item retrieved", await InventoryService.get(req.params.id));

exports.create = async (req, res) =>
  ApiResponse.success(res, 201, "Inventory item created", await InventoryService.create(req.body, req));

exports.update = async (req, res) =>
  ApiResponse.success(res, 200, "Inventory item updated", await InventoryService.update(req.params.id, req.body, req));

exports.adjust = async (req, res) =>
  ApiResponse.success(res, 200, "Stock adjusted", await InventoryService.adjust(req.params.id, req.body, req));

exports.history = async (req, res) =>
  ApiResponse.success(res, 200, "Stock history retrieved", await InventoryService.history(req.params.id));
