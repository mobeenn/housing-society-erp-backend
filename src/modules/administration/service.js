const SocietySettings = require("./societySettings.model");
const NumberingRule = require("./numberingRule.model");
const {
  Block,
  Street,
  PlotCategory,
  PropertyType,
  Department,
  NocType,
} = require("./masterData.model");
const { AuditLog, createAuditLog } = require("./auditLog.model");
const ApiError = require("../../utils/ApiError");

/**
 * Administration Service
 * Handles business logic for settings, numbering rules, master data, and audit logs
 */
class AdministrationService {
  // ── Society Settings ──────────────────────────────
  static async getSocietySettings() {
    return await SocietySettings.get();
  }

  static async updateSocietySettings(data, req) {
    const before = await SocietySettings.get();
    const updated = await SocietySettings.update(data);

    await createAuditLog({
      req,
      entityType: "SocietySettings",
      entityId: updated._id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before, after: updated },
    });

    return updated;
  }

  // ── Numbering Rules ───────────────────────────────
  static async getNumberingRules() {
    return await NumberingRule.find({});
  }

  static async updateNumberingRule(id, data, req) {
    const rules = await NumberingRule.find({ _id: id });
    const before = rules[0];

    if (!before) {
      throw new ApiError(404, "Numbering rule not found");
    }

    const updated = await NumberingRule.update(id, data);

    await createAuditLog({
      req,
      entityType: "NumberingRule",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before, after: updated },
    });

    return updated;
  }

  static async getNextNumber(entityType) {
    return await NumberingRule.getNextNumber(entityType);
  }

  // ── Master Data Generic Handlers ─────────────────
  static _getModel(type) {
    switch (type) {
      case "blocks":
        return Block;
      case "streets":
        return Street;
      case "plot-categories":
        return PlotCategory;
      case "property-types":
        return PropertyType;
      case "departments":
        return Department;
      case "noc-types":
        return NocType;
      default:
        throw new ApiError(400, `Invalid master data type: ${type}`);
    }
  }

  static async getMasterData(type, includeArchived = false) {
    const model = this._getModel(type);
    const query = includeArchived ? {} : { isActive: true };
    return await model.find(query);
  }

  static async createMasterData(type, data, req) {
    const model = this._getModel(type);
    const created = await model.create(data, req.user._id);

    await createAuditLog({
      req,
      entityType: type,
      entityId: created._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: created },
    });

    return created;
  }

  static async updateMasterData(type, id, data, req) {
    const model = this._getModel(type);
    const before = await model.findById(id);

    if (!before) {
      throw new ApiError(404, "Item not found");
    }

    const updated = await model.update(id, data);

    await createAuditLog({
      req,
      entityType: type,
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before, after: updated },
    });

    return updated;
  }

  static async archiveMasterData(type, id, req) {
    const model = this._getModel(type);
    const before = await model.findById(id);

    if (!before) {
      throw new ApiError(404, "Item not found");
    }

    const updated = await model.archive(id);

    await createAuditLog({
      req,
      entityType: type,
      entityId: id,
      action: AuditLog.ACTIONS.STATUS_CHANGE,
      changes: { before, after: updated },
      meta: { action: "archive" },
    });

    return updated;
  }

  static async restoreMasterData(type, id, req) {
    const model = this._getModel(type);
    const before = await model.findById(id);

    if (!before) {
      throw new ApiError(404, "Item not found");
    }

    const updated = await model.restore(id);

    await createAuditLog({
      req,
      entityType: type,
      entityId: id,
      action: AuditLog.ACTIONS.STATUS_CHANGE,
      changes: { before, after: updated },
      meta: { action: "restore" },
    });

    return updated;
  }

  // ── Audit Logs ────────────────────────────────────
  static async getAuditLogs({
    page = 1,
    limit = 50,
    entityType,
    userId,
    action,
    startDate,
    endDate,
  }) {
    const query = {};

    if (entityType) query.entityType = entityType;
    if (userId) query.userId = userId;
    if (action) query.action = action;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate).toISOString();
      if (endDate) query.timestamp.$lte = new Date(endDate).toISOString();
    }

    const skip = (page - 1) * limit;
    const logs = await AuditLog.find(query, {
      skip,
      limit: parseInt(limit, 10),
      sort: { timestamp: -1 },
    });

    const total = await AuditLog.count(query);

    return {
      logs,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = AdministrationService;
