const fs = require("fs");
const DocumentService = require("./service");
const Document = require("./document.model");
const ApiResponse = require("../../utils/apiResponse");

exports.uploadDocument = async (req, res) => ApiResponse.success(res, 201, await DocumentService.upload(req.body, req.file, req), "Document uploaded successfully");
exports.listDocuments = async (req, res) => ApiResponse.success(res, 200, await DocumentService.list(req.query));
exports.downloadDocument = async (req, res) => {
  const { document, absolutePath } = await DocumentService.getDownload(req.params.id);
  res.setHeader("Content-Disposition", `attachment; filename="${document.fileName.replace(/[\"\\]/g, "_")}"`);
  res.type(document.mimeType);
  fs.createReadStream(absolutePath).on("error", () => res.status(404).end()).pipe(res);
};
exports.verifyDocument = async (req, res) => ApiResponse.success(res, 200, await DocumentService.verify(req.params.id, req.body.verificationStatus, req), "Document verification updated");
exports.getVerificationStatuses = (_req, res) => ApiResponse.success(res, 200, Object.values(Document.VERIFICATION_STATUS));