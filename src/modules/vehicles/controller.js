const { VehicleService } = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) =>
  ApiResponse.success(res, 200, await VehicleService.list(req.query));

exports.get = async (req, res) =>
  ApiResponse.success(res, 200, await VehicleService.get(req.params.id));

exports.create = async (req, res) =>
  ApiResponse.success(
    res,
    201,
    await VehicleService.create(req.body, req),
    "Vehicle registered"
  );

exports.update = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await VehicleService.update(req.params.id, req.body, req),
    "Vehicle updated"
  );

exports.delete = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await VehicleService.delete(req.params.id, req),
    "Vehicle deleted"
  );

exports.issueSticker = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await VehicleService.issueSticker(req.params.id, req.body.stickerNumber, req),
    "Sticker issued"
  );

exports.updateStatus = async (req, res) =>
  ApiResponse.success(
    res,
    200,
    await VehicleService.updateStatus(req.params.id, req.body.status, req),
    "Vehicle status updated"
  );
