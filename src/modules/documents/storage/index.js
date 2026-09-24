const { LocalStorageAdapter } = require("./localStorage");

// Replace this adapter with an S3-compatible implementation without changing routes or the document contract.
const storageAdapter = new LocalStorageAdapter();

module.exports = storageAdapter;