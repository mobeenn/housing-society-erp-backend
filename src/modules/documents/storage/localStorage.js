const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const UPLOADS_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "housing-society-erp", "uploads")
  : path.resolve(__dirname, "../../../../uploads");

class LocalStorageAdapter {
  getMulterStorage() {
    return {
      destination: (_req, _file, cb) => {
        fs.mkdir(UPLOADS_DIR, { recursive: true }, (error) => cb(error, UPLOADS_DIR));
      },
      filename: (_req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`);
      },
    };
  }

  getAbsolutePath(fileName) {
    const safeName = path.basename(fileName);
    const absolutePath = path.resolve(UPLOADS_DIR, safeName);
    if (!absolutePath.startsWith(`${UPLOADS_DIR}${path.sep}`)) {
      throw new Error("Invalid document path");
    }
    return absolutePath;
  }
}

module.exports = { LocalStorageAdapter, UPLOADS_DIR };