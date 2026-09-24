const DocumentService = require("./service");
const Document = require("./document.model");
const ApiResponse = require("../../utils/apiResponse");

exports.uploadDocument = async (req, res) => ApiResponse.success(res, 201, await DocumentService.upload(req.body, req.file, req), "Document uploaded successfully");
exports.listDocuments = async (req, res) => ApiResponse.success(res, 200, await DocumentService.list(req.query));
exports.downloadDocument = async (req, res) => {
  const { document, fileBuffer } = await DocumentService.getDownload(req.params.id);
  res.setHeader("Content-Disposition", `attachment; filename="${document.fileName.replace(/[\"\\]/g, "_")}"`);
  res.type(document.mimeType);
  return res.send(fileBuffer);
};
exports.verifyDocument = async (req, res) => ApiResponse.success(res, 200, await DocumentService.verify(req.params.id, req.body.verificationStatus, req), "Document verification updated");
exports.getVerificationStatuses = (_req, res) => ApiResponse.success(res, 200, Object.values(Document.VERIFICATION_STATUS));