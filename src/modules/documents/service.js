const Document = require("./document.model");
const { documentMetadataSchema } = require("./validation");
const storage = require("./storage");
const Member = require("../members/member.model");
const { Plot } = require("../properties/plot.model");
const { Booking } = require("../bookings/booking.model");
const { AuditLog, createAuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");
const RbacService = require("../rbac/service");

const entityModels = { member: Member, plot: Plot, booking: Booking };

/** Map document relatedEntityType → RBAC module key for row-level access. */
const ENTITY_MODULE = {
  member: "members",
  plot: "plots",
  booking: "bookings",
  transfer: "transfers",
  transferrequest: "transfers",
  noc: "nocs",
  nocapplication: "nocs",
  possession: "possession",
  possessionapplication: "possession",
  construction: "construction",
  constructionapplication: "construction",
  complaint: "complaints",
  expense: "expenses",
  payment: "payments",
  employee: "hr",
  vendor: "procurement",
  purchaserequest: "procurement",
  purchaseorder: "procurement",
  grn: "procurement",
};

const normalizeDate = (value, field) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${field} must be a valid date`);
  return date.toISOString();
};

class DocumentService {
  static async validateRelatedEntity(type, id) {
    const model = entityModels[type.toLowerCase()];
    if (model && !(await model.findById(id))) throw new ApiError(400, `Related ${type} not found`);
  }

  static async upload(metadata, file, req) {
    if (!file) throw new ApiError(400, "A document file is required");
    const data = documentMetadataSchema.parse(metadata);
    data.relatedEntityType = data.relatedEntityType.toLowerCase();
    await this.validateRelatedEntity(data.relatedEntityType, data.relatedEntityId);
    const logicalQuery = { relatedEntityType: data.relatedEntityType, relatedEntityId: data.relatedEntityId, type: data.type, number: data.number || null };
    const latest = await Document.findLatestVersion(logicalQuery);
    const version = (latest?.version || 0) + 1;
    const storageKey = await storage.persistUpload(file);
    const document = await Document.create({ ...data, issueDate: normalizeDate(data.issueDate, "Issue date"), expiryDate: normalizeDate(data.expiryDate, "Expiry date"), fileUrl: null, fileName: file.originalname, storageKey, mimeType: file.mimetype, size: file.size, version, uploadedBy: req.user._id });
    await Document.update(document._id, { fileUrl: `/api/documents/${document._id}/download` });
    if (latest) await Document.update(latest._id, { isSuperseded: true, supersededBy: document._id });
    const saved = await Document.findById(document._id);
    await createAuditLog({ req, entityType: "Document", entityId: saved._id, action: AuditLog.ACTIONS.CREATE, changes: { after: saved }, meta: { version, supersedes: latest?._id || null } });
    return saved;
  }

  static async list(filters) {
    const query = {};
    if (filters.relatedEntityType) query.relatedEntityType = filters.relatedEntityType.toLowerCase();
    if (filters.relatedEntityId) query.relatedEntityId = filters.relatedEntityId;
    const { paginate } = require("../../utils/paginate");
    const rows = await Document.find(query, { sort: { createdAt: -1 } });
    // Entity-scoped lists stay uncapped for detail pages; global lists paginate.
    if (filters.relatedEntityType && filters.relatedEntityId) {
      return { data: rows, pagination: { page: 1, limit: rows.length, total: rows.length, pages: 1 } };
    }
    return paginate(rows, filters);
  }

  static async assertRelatedEntityAccess(user, document, action) {
    const type = String(document.relatedEntityType || "").toLowerCase();
    const moduleKey = ENTITY_MODULE[type];
    if (!moduleKey) {
      // Unknown entity types still require documents module access (route-level).
      return;
    }
    if (!(await RbacService.isAllowed(user, moduleKey, action))) {
      throw new ApiError(
        403,
        `You do not have permission to ${action} documents for this ${type || "record"}`,
      );
    }
  }

  static async getDownload(id, user) {
    const document = await Document.findById(id);
    if (!document) throw new ApiError(404, "Document not found");
    if (user) await this.assertRelatedEntityAccess(user, document, "view");
    const fileBuffer = await storage.readFile(document.storageKey || document.fileName);
    if (!fileBuffer) throw new ApiError(404, "Document file not found");
    return { document, fileBuffer };
  }

  static async verify(id, status, req) {
    if (![Document.VERIFICATION_STATUS.VERIFIED, Document.VERIFICATION_STATUS.REJECTED].includes(status)) throw new ApiError(400, "Verification status must be Verified or Rejected");
    const document = await Document.findById(id);
    if (!document) throw new ApiError(404, "Document not found");
    await this.assertRelatedEntityAccess(req.user, document, "approve");
    await Document.update(id, { verificationStatus: status, verifiedBy: req.user._id, verifiedAt: new Date().toISOString() });
    const updated = await Document.findById(id);
    await createAuditLog({ req, entityType: "Document", entityId: id, action: AuditLog.ACTIONS.STATUS_CHANGE, changes: { before: document, after: updated } });
    return updated;
  }
}

module.exports = DocumentService;