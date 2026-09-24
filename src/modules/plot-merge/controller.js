const PlotMergeService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) => ApiResponse.success(res, 200, "Plot merges retrieved", await PlotMergeService.list(req.query));
exports.eligiblePlots = async (_req, res) => ApiResponse.success(res, 200, "Merge-eligible plots retrieved", await PlotMergeService.eligiblePlots());
exports.get = async (req, res) => ApiResponse.success(res, 200, "Plot merge retrieved", await PlotMergeService.get(req.params.id));
exports.execute = async (req, res) => ApiResponse.success(res, 201, "Plots merged successfully", await PlotMergeService.execute(req.body, req));
exports.invoice = async (req, res) => {
  const buffer = await PlotMergeService.invoicePdf(req.params.id);
  res.type("application/pdf")
    .setHeader("Content-Disposition", `attachment; filename="plot-merge-${req.params.id}.pdf"`)
    .send(buffer);
};
