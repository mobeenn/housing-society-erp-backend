const { db } = require("../../config/db");

class AuditLog {
  static collectionName = "auditLogs";

  static async findOne(query) {
    return await db.collection(this.collectionName).findOne(query);
  }

  static async find(query = {}, options = {}) {
    return await db.collection(this.collectionName).find(query, options);
  }

  static async countDocuments(query = {}) {
    return await db.collection(this.collectionName).countDocuments(query);
  }

  static async create(logData) {
    return await db.collection(this.collectionName).insertOne({
      userId: logData.userId || null,
      action: logData.action?.trim(),
      ip: logData.ip || null,
      userAgent: logData.userAgent || null,
      status: logData.status || "success",
      meta: logData.meta || {},
      timestamp: new Date().toISOString(),
    });
  }

  static async findById(id) {
    return await db.collection(this.collectionName).findOne({ _id: id });
  }
}

module.exports = AuditLog;
