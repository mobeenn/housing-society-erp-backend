const BuyBackService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) => ApiResponse.success(res, 200, "Buyback records retrieved", await BuyBackService.list(req.query));
exports.eligibleBookings = async (_req, res) => ApiResponse.success(res, 200, "Eligible bookings retrieved", await BuyBackService.eligibleBookings());
exports.get = async (req, res) => ApiResponse.success(res, 200, "Buyback record retrieved", await BuyBackService.get(req.params.id));
exports.execute = async (req, res) => ApiResponse.success(res, 201, "Buyback/cancellation completed successfully", await BuyBackService.execute(req.body, req));
exports.invoice = async (req, res) => {
  const buffer = await BuyBackService.invoicePdf(req.params.id);
  res.type("application/pdf")
    .setHeader("Content-Disposition", `attachment; filename="buyback-${req.params.id}.pdf"`)
    .send(buffer);
};
