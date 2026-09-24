const multer = require("multer");
const path = require("path");
const ApiError = require("../../utils/ApiError");
const storage = require("./storage");

const allowedTypes = new Map([
  ["application/pdf", [".pdf"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["application/msword", [".doc"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [".docx"]],
]);

const upload = multer({
  storage: storage.usesMemoryStorage
    ? multer.memoryStorage()
    : multer.diskStorage(storage.getMulterStorage()),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const extensions = allowedTypes.get(file.mimetype);
    if (!extensions || !extensions.includes(extension)) {
      return cb(new ApiError(400, "Unsupported or unsafe file type. Upload PDF, JPG, PNG, WEBP, DOC, or DOCX files only."));
    }
    cb(null, true);
  },
});

const parseDocumentUpload = (req, res, next) => upload.single("file")(req, res, (error) => {
  if (!error) return next();
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return next(new ApiError(413, "Document exceeds the 10 MB size limit"));
  }
  return next(error);
});

module.exports = { parseDocumentUpload };