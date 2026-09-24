const InvoiceService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.list = async (req, res) => {
  const result = await InvoiceService.list(req.query);
  return ApiResponse.success(res, 200, "Invoices retrieved", result);
};

exports.get = async (req, res) => {
  const invoice = await InvoiceService.getById(req.params.id);
  return ApiResponse.success(res, 200, "Invoice retrieved", invoice);
};

exports.cancel = async (req, res) => {
  const invoice = await InvoiceService.cancel(req.params.id, req);
  return ApiResponse.success(res, 200, "Invoice cancelled", invoice);
};
