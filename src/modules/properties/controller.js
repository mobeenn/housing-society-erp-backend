const PlotService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.getPlots = async (req, res) => {
  const result = await PlotService.search(req.query);
  ApiResponse.success(res, 200, result);
};

exports.getPlotById = async (req, res) => {
  ApiResponse.success(res, 200, await PlotService.getById(req.params.id));
};

exports.getPlotHistory = async (req, res) => {
  ApiResponse.success(res, 200, await PlotService.getHistory(req.params.id));
};

exports.createPlot = async (req, res) => {
  ApiResponse.success(res, 201, await PlotService.create(req.body, req), "Plot created successfully");
};

exports.updatePlot = async (req, res) => {
  ApiResponse.success(res, 200, await PlotService.update(req.params.id, req.body, req), "Plot updated successfully");
};

exports.updatePlotStatus = async (req, res) => {
  ApiResponse.success(res, 200, await PlotService.update(req.params.id, req.body, req), "Plot status updated successfully");
};

exports.deletePlot = async (req, res) => {
  ApiResponse.success(res, 200, await PlotService.remove(req.params.id, req));
};