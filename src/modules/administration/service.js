const { prisma } = require("../../config/prisma");
const ApiError = require("../../utils/ApiError");
const { createAuditLog } = require("./auditLog.model");

/**
 * Administration Service
 * Handles business logic for settings, numbering rules, master data, and audit logs
 */
class AdministrationService {
  // ── Society Settings ──────────────────────────────
  static async getSocietySettings() {
    const settings = await prisma.societySettings.findFirst({
      where: { id: "default" },
    });

    if (!settings) {
      // Return defaults if no settings exist
      return {
        id: "default",
        name: "Housing Society",
        logo: null,
        address: {},
        fiscalYear: {},
        currency: "PKR",
        feeSettings: {},
        enableSubDealerOverride: false,
        subDealerOverrideRate: null,
        recoveryAutoBlockThreshold: 49,
        recoveryAllowSelfReserve: false,
        contactInfo: {},
        updatedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return settings;
  }

  static async updateSocietySettings(data, req) {
    const before = await this.getSocietySettings();

    const updated = await prisma.societySettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        name: data.name || "Housing Society",
        logo: data.logo || null,
        address: data.address || {},
        fiscalYear: data.fiscalYear || {},
        currency: data.currency || "PKR",
        feeSettings: data.feeSettings || {},
        enableSubDealerOverride: data.enableSubDealerOverride || false,
        subDealerOverrideRate: data.subDealerOverrideRate || null,
        recoveryAutoBlockThreshold: data.recoveryAutoBlockThreshold || 49,
        recoveryAllowSelfReserve: data.recoveryAllowSelfReserve || false,
        contactInfo: data.contactInfo || {},
        updatedById: req.user?.id || null,
      },
      update: {
        name: data.name,
        logo: data.logo,
        address: data.address,
        fiscalYear: data.fiscalYear,
        currency: data.currency,
        feeSettings: data.feeSettings,
        enableSubDealerOverride: data.enableSubDealerOverride,
        subDealerOverrideRate: data.subDealerOverrideRate,
        recoveryAutoBlockThreshold: data.recoveryAutoBlockThreshold,
        recoveryAllowSelfReserve: data.recoveryAllowSelfReserve,
        contactInfo: data.contactInfo,
        updatedById: req.user?.id || null,
      },
    });

    await createAuditLog({
      req,
      entityType: "SocietySettings",
      entityId: updated.id,
      action: "update",
      changes: { before, after: updated },
    });

    return updated;
  }

  // ── Numbering Rules ───────────────────────────────
  static async getNumberingRules() {
    return await prisma.numberingRule.findMany({
      orderBy: { entityType: "asc" },
    });
  }

  static async updateNumberingRule(id, data, req) {
    const before = await prisma.numberingRule.findUnique({
      where: { id },
    });

    if (!before) {
      throw new ApiError(404, "Numbering rule not found");
    }

    const updated = await prisma.numberingRule.update({
      where: { id },
      data,
    });

    await createAuditLog({
      req,
      entityType: "NumberingRule",
      entityId: id,
      action: "update",
      changes: { before, after: updated },
    });

    return updated;
  }

  static async getNextNumber(entityType) {
    const numberingService = require("./numbering.service");
    return await numberingService.getNextNumber(entityType);
  }

  // ── Master Data Generic Handlers ─────────────────
  static _getModel(type) {
    switch (type) {
      case "blocks":
        return { model: "prisma.block", field: "block" };
      case "streets":
        return { model: "prisma.street", field: "street" };
      case "plot-categories":
        return { model: "prisma.plotCategory", field: "plotCategory" };
      case "property-types":
        return { model: "prisma.propertyType", field: "propertyType" };
      case "departments":
        return { model: "prisma.department", field: "department" };
      case "noc-types":
        return { model: "prisma.nocType", field: "nocType" };
      default:
        throw new ApiError(400, `Invalid master data type: ${type}`);
    }
  }

  static async getMasterData(type, includeArchived = false) {
    const { model } = this._getModel(type);
    const prismaModel = eval(model);

    const where = includeArchived ? {} : { isActive: true };

    return await prismaModel.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  static async createMasterData(type, data, req) {
    const { model } = this._getModel(type);
    const prismaModel = eval(model);

    const created = await prismaModel.create({
      data: {
        name: data.name,
        code: data.code || null,
        description: data.description || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdById: req.user?.id || null,
      },
    });

    await createAuditLog({
      req,
      entityType: type,
      entityId: created.id,
      action: "create",
      changes: { after: created },
    });

    return created;
  }

  static async updateMasterData(type, id, data, req) {
    const { model } = this._getModel(type);
    const prismaModel = eval(model);

    const before = await prismaModel.findUnique({
      where: { id },
    });

    if (!before) {
      throw new ApiError(404, "Item not found");
    }

    const updated = await prismaModel.update({
      where: { id },
      data,
    });

    await createAuditLog({
      req,
      entityType: type,
      entityId: id,
      action: "update",
      changes: { before, after: updated },
    });

    return updated;
  }

  static async archiveMasterData(type, id, req) {
    const { model } = this._getModel(type);
    const prismaModel = eval(model);

    const before = await prismaModel.findUnique({
      where: { id },
    });

    if (!before) {
      throw new ApiError(404, "Item not found");
    }

    const updated = await prismaModel.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      req,
      entityType: type,
      entityId: id,
      action: "statusChange",
      changes: { before, after: updated },
      meta: { action: "archive" },
    });

    return updated;
  }

  static async restoreMasterData(type, id, req) {
    const { model } = this._getModel(type);
    const prismaModel = eval(model);

    const before = await prismaModel.findUnique({
      where: { id },
    });

    if (!before) {
      throw new ApiError(404, "Item not found");
    }

    const updated = await prismaModel.update({
      where: { id },
      data: { isActive: true },
    });

    await createAuditLog({
      req,
      entityType: type,
      entityId: id,
      action: "statusChange",
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
    const where = {};

    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;
    if (action) where.action = action;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: parseInt(limit, 10),
    });

    const total = await prisma.auditLog.count({ where });

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
