const PDFDocument = require("pdfkit");
const { PaymentService } = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.previewPayment = async (req, res) => ApiResponse.success(res, 200, await PaymentService.preview(req.body));
exports.createPayment = async (req, res) => ApiResponse.success(res, 201, await PaymentService.create(req.body, req), "Payment recorded successfully");
exports.getPayments = async (req, res) => ApiResponse.success(res, 200, await PaymentService.list(req.query));
exports.getPayment = async (req, res) => ApiResponse.success(res, 200, await PaymentService.getById(req.params.id));
exports.getStatement = async (req, res) => ApiResponse.success(res, 200, await PaymentService.statement(req.params.id));
exports.getReceipt = async (req, res) => {
  const payment = await PaymentService.getById(req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="receipt-${payment.receiptNumber}.pdf"`);
  const pdf = new PDFDocument({ margin: 50 });
  pdf.pipe(res);
  pdf.fontSize(20).text("Housing Society Payment Receipt").moveDown();
  pdf.fontSize(11).text(`Receipt: ${payment.receiptNumber}`).text(`Date: ${new Date(payment.createdAt).toLocaleString()}`).text(`Member: ${payment.memberRef?.name || payment.member}`).text(`Plot: ${payment.plotRef?.plotNumber || "—"}`).text(`Method: ${payment.method}`).text(`Amount: ${Number(payment.amount).toLocaleString()}`).moveDown().text(payment.remarks || "");
  pdf.end();
};