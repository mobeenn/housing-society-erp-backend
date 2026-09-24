const { createAuditLog: createAuditLogFn } = require("../modules/administration/auditLog.model");

/**
 * Simplified audit log wrapper for service layer usage
 * @param {Object} params - Audit log parameters
 * @param {string} params.userId - ID of user performing the action
 * @param {string} params.action - Action performed (CREATE, UPDATE, DELETE, etc.)
 * @param {string} params.entityType - Type of entity affected
 * @param {string} params.entityId - ID of the affected entity
 * @param {Object} params.details - Additional details about the action
 * @param {Object} params.changes - Before/after changes object
 * @param {string} params.status - Status of the action (success/failure)
 */
const createAuditLog = async ({
  userId,
  action,
  entityType,
  entityId,
  details = {},
  changes = null,
  status = "success",
}) => {
  return await createAuditLogFn({
    userId,
    entityType,
    entityId,
    action,
    changes,
    status,
    meta: details,
  });
};

module.exports = { createAuditLog };
