const fs = require("fs").promises;
const path = require("path");
const dotenv = require("dotenv");
const { put } = require("@vercel/blob");

const importEnvPath = process.env.IMPORT_ENV_FILE
  || path.resolve(__dirname, "../.env.production.local");
dotenv.config({ path: importEnvPath });
if (process.env.BLOB_READ_WRITE_TOKEN) {
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.BLOB_STORE_ID;
}

const root = path.resolve(__dirname, "..");
const dbPath = process.env.LOCAL_DB_PATH || path.join(root, "data", "db.json");
const uploadsPath = process.env.LOCAL_UPLOADS_PATH || path.join(root, "uploads");
const dbBlobPath = process.env.DB_BLOB_PATH || "housing-society/data/db.json";
const documentsPrefix = process.env.DOCUMENTS_BLOB_PREFIX || "documents";

async function importLocalData() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error("Connect a private Vercel Blob store or set BLOB_READ_WRITE_TOKEN before importing.");
  }

  const database = await fs.readFile(dbPath);
  await put(dbBlobPath, database, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });

  let documentCount = 0;
  let files = [];
  try {
    files = await fs.readdir(uploadsPath, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const entry of files) {
    if (!entry.isFile()) continue;
    const fileName = path.basename(entry.name);
    const content = await fs.readFile(path.join(uploadsPath, fileName));
    await put(`${documentsPrefix}/${fileName}`, content, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
      cacheControlMaxAge: 0,
    });
    documentCount += 1;
  }

  console.log(`Imported ${dbBlobPath} and ${documentCount} document file(s) into private Vercel Blob.`);
}

importLocalData().catch((error) => {
  console.error("Blob import failed:", error.message);
  process.exitCode = 1;
});
