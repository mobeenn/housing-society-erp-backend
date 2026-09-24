const { db } = require("../../config/db");

class Document {
  static collectionName = "documents";

  static VERIFICATION_STATUS = {
    PENDING: "Pending",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
  };

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async findLatestVersion(query) {
    const records = await db.collection(this.collectionName).find(query, { sort: { version: -1 } });
    return records[0] || null;
  }

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: data.relatedEntityId,
      type: data.type,
      number: data.number || null,
      issueDate: data.issueDate || null,
      expiryDate: data.expiryDate || null,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      storageKey: data.storageKey,
      mimeType: data.mimeType,
      size: data.size,
      verificationStatus: Document.VERIFICATION_STATUS.PENDING,
      version: data.version,
      isSuperseded: false,
      supersededBy: null,
      uploadedBy: data.uploadedBy,
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

module.exports = Document;