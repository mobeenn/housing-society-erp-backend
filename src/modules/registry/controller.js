const RegistryService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.plotOptions = async (req, res) => ApiResponse.success(res, 200, "Registry plot options retrieved", await RegistryService.plotOptions(req.query));
exports.list = async (req, res) => ApiResponse.success(res, 200, "Registry batches retrieved", await RegistryService.list(req.query));
exports.get = async (req, res) => ApiResponse.success(res, 200, "Registry batch retrieved", await RegistryService.get(req.params.id));
exports.create = async (req, res) => ApiResponse.success(res, 201, "Registry batch created", await RegistryService.create(req.body, req));
exports.complete = async (req, res) => ApiResponse.success(res, 200, "Registry batch completed", await RegistryService.complete(req.params.id, req.body, req));
