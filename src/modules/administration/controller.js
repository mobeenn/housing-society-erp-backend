const AdministrationService = require("./service");
const ApiResponse = require("../../utils/apiResponse");
const {
  societySettingsSchema,
  numberingRuleSchema,
  masterDataSchema,
} = require("./validation");

/**
 * Administration Controller
 */

// ── Society Settings ──────────────────────────────
const getSocietySettings = async (_req, res) => {
  const settings = await AdministrationService.getSocietySettings();
  ApiResponse.success(res, 200, "Society settings retrieved", settings);
};

const updateSocietySettings = async (req, res) => {
  const validated = societySettingsSchema.parse(req.body);
  const updated = await AdministrationService.updateSocietySettings(validated, req);
  ApiResponse.success(res, 200, "Society settings updated", updated);
};

// ── Numbering Rules ───────────────────────────────
const getNumberingRules = async (_req, res) => {
  const rules = await AdministrationService.getNumberingRules();
  ApiResponse.success(res, 200, "Numbering rules retrieved", rules);
};

const updateNumberingRule = async (req, res) => {
  const { id } = req.params;
  const validated = numberingRuleSchema.parse(req.body);
  const updated = await AdministrationService.updateNumberingRule(id, validated, req);
  ApiResponse.success(res, 200, "Numbering rule updated", updated);
};

// ── Master Data ───────────────────────────────────
const getMasterData = async (req, res) => {
  const { type } = req.params;
  const includeArchived = req.query.includeArchived === "true";
  const data = await AdministrationService.getMasterData(type, includeArchived);
  ApiResponse.success(res, 200, `${type} retrieved`, data);
};

const createMasterData = async (req, res) => {
  const { type } = req.params;
  const validated = masterDataSchema.parse(req.body);
  const created = await AdministrationService.createMasterData(type, validated, req);
  ApiResponse.success(res, 201, `${type} item created`, created);
};

const updateMasterData = async (req, res) => {
  const { type, id } = req.params;
  const validated = masterDataSchema.parse(req.body);
  const updated = await AdministrationService.updateMasterData(type, id, validated, req);
  ApiResponse.success(res, 200, `${type} item updated`, updated);
};

const archiveMasterData = async (req, res) => {
  const { type, id } = req.params;
  const updated = await AdministrationService.archiveMasterData(type, id, req);
  ApiResponse.success(res, 200, `${type} item archived`, updated);
};

const restoreMasterData = async (req, res) => {
  const { type, id } = req.params;
  const updated = await AdministrationService.restoreMasterData(type, id, req);
  ApiResponse.success(res, 200, `${type} item restored`, updated);
};

// ── Audit Logs ────────────────────────────────────
const getAuditLogs = async (req, res) => {
  const { page, limit, entityType, userId, action, startDate, endDate } = req.query;
  const result = await AdministrationService.getAuditLogs({
    page,
    limit,
    entityType,
    userId,
    action,
    startDate,
    endDate,
  });
  ApiResponse.success(res, 200, "Audit logs retrieved", result);
};

module.exports = {
  getSocietySettings,
  updateSocietySettings,
  getNumberingRules,
  updateNumberingRule,
  getMasterData,
  createMasterData,
  updateMasterData,
  archiveMasterData,
  restoreMasterData,
  getAuditLogs,
};
