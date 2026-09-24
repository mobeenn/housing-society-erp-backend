const { Plot, OwnershipHistory } = require("./plot.model");
const { canTransition } = require("./stateMachine");
const { Block, Street, PlotCategory, PropertyType } = require("../administration/masterData.model");
const Member = require("../members/member.model");
const { AuditLog, createAuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");

const referenceModels = { block: Block, street: Street, category: PlotCategory, propertyType: PropertyType };

class PlotService {
  static async validateReferences(data) {
    for (const field of Object.keys(referenceModels)) {
      if (data[field] && !(await referenceModels[field].findById(data[field]))) {
        throw new ApiError(400, `${field} reference not found`);
      }
    }
    if (data.currentOwner && !(await Member.findById(data.currentOwner))) {
      throw new ApiError(400, "Current owner not found");
    }
  }

  static async enrich(plot) {
    if (!plot) return null;
    const [block, street, category, propertyType, currentOwner] = await Promise.all([
      Block.findById(plot.block),
      Street.findById(plot.street),
      PlotCategory.findById(plot.category),
      PropertyType.findById(plot.propertyType),
      plot.currentOwner ? Member.findById(plot.currentOwner) : null,
    ]);
    return { ...plot, blockRef: block, streetRef: street, categoryRef: category, propertyTypeRef: propertyType, currentOwnerRef: currentOwner };
  }

  static async search(filters) {
    const all = await Plot.find({}, { sort: { createdAt: -1 } });
    const search = filters.search?.trim().toLowerCase();
    const matches = [];
    for (const plot of all) {
      const refs = await Promise.all([
        Block.findById(plot.block),
        Street.findById(plot.street),
        PlotCategory.findById(plot.category),
        plot.currentOwner ? Member.findById(plot.currentOwner) : null,
      ]);
      const [block, street, category, owner] = refs;
      const haystack = [plot.plotNumber, plot.fileNumber, plot.location, block?.name, street?.name, owner?.name, owner?.memberId]
        .filter(Boolean).join(" ").toLowerCase();
      if (search && !haystack.includes(search)) continue;
      if (filters.plot && plot.plotNumber?.toLowerCase() !== filters.plot.toLowerCase()) continue;
      if (filters.owner && plot.currentOwner !== filters.owner && owner?.name?.toLowerCase() !== filters.owner.toLowerCase()) continue;
      if (filters.file && plot.fileNumber?.toLowerCase() !== filters.file.toLowerCase()) continue;
      if (filters.block && plot.block !== filters.block) continue;
      if (filters.street && plot.street !== filters.street) continue;
      if (filters.category && plot.category !== filters.category) continue;
      if (filters.status && plot.status !== filters.status) continue;
      matches.push({ ...plot, blockRef: block, streetRef: street, categoryRef: category, currentOwnerRef: owner });
    }
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    return {
      data: matches.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total: matches.length, pages: Math.ceil(matches.length / limit) },
    };
  }

  static async getById(id) {
    const plot = await Plot.findById(id);
    if (!plot) throw new ApiError(404, "Plot not found");
    return this.enrich(plot);
  }

  static async create(data, req) {
    await this.validateReferences(data);
    if (data.status && data.status !== Plot.STATUS.AVAILABLE) {
      throw new ApiError(409, `New plots must start in ${Plot.STATUS.AVAILABLE} status`);
    }
    const plot = await Plot.create(data, req.user._id);
    if (plot.currentOwner) {
      await OwnershipHistory.append({ plot: plot._id, member: plot.currentOwner, fromDate: plot.ownerSince, type: "original" });
    }
    await createAuditLog({ req, entityType: "Plot", entityId: plot._id, action: AuditLog.ACTIONS.CREATE, changes: { after: plot } });
    return this.enrich(plot);
  }

  static async update(id, data, req) {
    const existing = await Plot.findById(id);
    if (!existing) throw new ApiError(404, "Plot not found");
    if ([Plot.STATUS.MERGED, Plot.STATUS.BOUGHT_BACK].includes(data.status) && !data.lifecycleAction) {
      throw new ApiError(409, "Irreversible lifecycle statuses must be changed through the lifecycle module");
    }
    await this.validateReferences(data);
    if (data.status && !canTransition(existing.status, data.status)) {
      throw new ApiError(409, `Invalid plot status transition: ${existing.status} → ${data.status}`);
    }
    const ownerChanged = data.currentOwner !== undefined && data.currentOwner !== existing.currentOwner;
    const now = new Date().toISOString();
    if (ownerChanged) {
      if (existing.currentOwner) {
        await OwnershipHistory.append({ plot: id, member: existing.currentOwner, fromDate: existing.ownerSince || existing.createdAt, toDate: now, type: "transfer", remarks: data.remarks });
      }
      if (data.currentOwner) {
        await OwnershipHistory.append({ plot: id, member: data.currentOwner, fromDate: now, type: "transfer", remarks: data.remarks });
      }
      data.ownerSince = data.currentOwner ? now : null;
    }
    await Plot.update(id, data);
    const updated = await Plot.findById(id);
    await createAuditLog({ req, entityType: "Plot", entityId: id, action: data.status ? AuditLog.ACTIONS.STATUS_CHANGE : AuditLog.ACTIONS.UPDATE, changes: { before: existing, after: updated } });
    return this.enrich(updated);
  }

  static async remove(id, req) {
    const existing = await Plot.findById(id);
    if (!existing) throw new ApiError(404, "Plot not found");
    await Plot.delete(id);
    await createAuditLog({ req, entityType: "Plot", entityId: id, action: AuditLog.ACTIONS.DELETE, changes: { before: existing } });
    return { message: "Plot deleted successfully" };
  }

  static async getHistory(id) {
    const plot = await Plot.findById(id);
    if (!plot) throw new ApiError(404, "Plot not found");
    const [rawOwnershipHistory, transactionHistory] = await Promise.all([
      OwnershipHistory.find({ plot: id }, { sort: { createdAt: 1 } }),
      AuditLog.find({ entityType: "Plot", entityId: id }, { sort: { timestamp: -1 } }),
    ]);
    const ownershipByInterval = new Map();
    rawOwnershipHistory.forEach((entry) => {
      const key = `${entry.member}:${entry.fromDate}`;
      const existing = ownershipByInterval.get(key);
      if (!existing || (!existing.toDate && entry.toDate)) ownershipByInterval.set(key, entry);
    });
    const ownershipHistory = await Promise.all(
      Array.from(ownershipByInterval.values()).map(async (entry) => ({
        ...entry,
        memberRef: await Member.findById(entry.member),
      }))
    );
    return { ownershipHistory, transactionHistory };
  }
}

module.exports = PlotService;