const { db } = require("../../config/db");

/**
 * Expanded AuditLog Model
 * Records all significant system actions and data changes
 */
class AuditLog {
  static collectionName = "auditLogs";

  static ACTIONS = {
    CREATE: "create",
    UPDATE: "update",
    DELETE: "delete",
    APPROVE: "approve",
    REJECT: "reject",
    CANCEL: "cancel",
    STATUS_CHANGE: "statusChange",
    LOGIN: "login",
    LOGOUT: "logout",
  };

  /**
   * Create an audit log entry
   */
  static async create(logData) {
    return await db.collection(this.collectionName).insertOne({
      userId: logData.userId || null,
      entityType: logData.entityType || null,
      entityId: logData.entityId || null,
      action: logData.action?.trim(),
      changes: logData.changes || null, // { before, after }
      ip: logData.ip || null,
      userAgent: logData.userAgent || null,
      status: logData.status || "success",
      meta: logData.meta || {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Find audit logs with pagination and filters
   */
  static async find(query = {}, options = {}) {
    return await db.collection(this.collectionName).find(query, options);
  }

  /**
   * Count audit logs matching query
   */
  static async count(query = {}) {
    return await db.collection(this.collectionName).countDocuments(query);
  }
}

/**
 * Helper utility to create audit logs with minimal boilerplate
 * Extracts IP and User-Agent from Express request if provided
 */
const createAuditLog = async ({
  req = null,
  userId = null,
  entityType = null,
  entityId = null,
  action,
  changes = null,
  status = "success",
  meta = {},
}) => {
  const ip = req?.ip || req?.connection?.remoteAddress || null;
  const userAgent = req?.headers?.["user-agent"] || null;
  const effectiveUserId = userId || req?.user?._id || null;

  return await AuditLog.create({
    userId: effectiveUserId,
    entityType,
    entityId,
    action,
    changes,
    ip,
    userAgent,
    status,
    meta,
  });
};

module.exports = {
  AuditLog,
  createAuditLog,
};
