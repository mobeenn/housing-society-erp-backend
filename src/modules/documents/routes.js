const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const { parseDocumentUpload } = require("./upload");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/", authorize("documents", "view"), controller.listDocuments);
router.post("/", authorize("documents", "create"), parseDocumentUpload, controller.uploadDocument);
router.get("/:id/download", authorize("documents", "view"), controller.downloadDocument);
router.patch("/:id/verify", authorize("documents", "approve"), controller.verifyDocument);

module.exports = router;