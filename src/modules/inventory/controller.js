const InventoryService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (_req, res) => ApiResponse.success(res, 200, "Inventory retrieved", await InventoryService.list());
exports.lowStock = async (_req, res) => ApiResponse.success(res, 200, "Low-stock inventory retrieved", await InventoryService.lowStock());
