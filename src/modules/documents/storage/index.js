const { LocalStorageAdapter } = require("./localStorage");
const { VercelBlobStorageAdapter } = require("./vercelBlob");

const hasBlobCredentials = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN
    || process.env.BLOB_STORE_ID
    || process.env.VERCEL_OIDC_TOKEN,
);
const storageAdapter = hasBlobCredentials
  ? new VercelBlobStorageAdapter()
  : new LocalStorageAdapter();

module.exports = storageAdapter;
