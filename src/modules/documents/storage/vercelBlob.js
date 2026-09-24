const path = require("path");
const crypto = require("crypto");
const { get, put } = require("@vercel/blob");

class VercelBlobStorageAdapter {
  constructor() {
    this.usesMemoryStorage = true;
  }

  async persistUpload(file) {
    const extension = path.extname(file.originalname).toLowerCase();
    const key = `documents/${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`;
    await put(key, file.buffer, {
      access: "private",
      addRandomSuffix: false,
      contentType: file.mimetype,
      cacheControlMaxAge: 0,
    });
    return key;
  }

  async readFile(key) {
    const normalized = path.posix.normalize(String(key || "")).replace(/^([./\\])+/, "");
    if (!normalized.startsWith("documents/") || normalized.includes("..")) {
      throw new Error("Invalid document storage key");
    }
    const result = await get(normalized, {
      access: "private",
      useCache: false,
    });
    if (!result) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
}

module.exports = { VercelBlobStorageAdapter };
