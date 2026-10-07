const { db } = require("../../config/db");
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
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();
    const ownerFilter = filters.owner?.trim();

    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.block) query.block = filters.block;
    if (filters.street) query.street = filters.street;
    if (filters.category) query.category = filters.category;
    // Exact filters: $regex maps to Prisma `contains`, so use equality here.
    if (filters.plot) query.plotNumber = filters.plot.trim();
    if (filters.file) query.fileNumber = filters.file.trim();

    if (ownerFilter) {
      const looksLikeId = /^[a-zA-Z0-9_-]{8,}$/.test(ownerFilter) && !/\s/.test(ownerFilter);
      if (looksLikeId) {
        query.currentOwner = ownerFilter;
      } else {
        const matchingOwners = await Member.find(
          {
            $or: [
              { name: { $regex: ownerFilter, $options: "i" } },
              { memberId: { $regex: ownerFilter, $options: "i" } },
            ],
          },
          { limit: 200, select: { _id: 1 } }
        );
        query.currentOwner = { $in: matchingOwners.map((m) => m._id) };
      }
    }

    if (search) {
      const textOr = [
        { plotNumber: { $regex: search, $options: "i" } },
        { fileNumber: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
      // Also match owners / blocks / streets by name (best-effort join via $in)
      const [ownerHits, blockHits, streetHits] = await Promise.all([
        Member.find(
          {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { memberId: { $regex: search, $options: "i" } },
            ],
          },
          { limit: 100, select: { _id: 1 } }
        ),
        Block.find({ name: { $regex: search, $options: "i" } }, { limit: 50, select: { _id: 1 } }),
        Street.find({ name: { $regex: search, $options: "i" } }, { limit: 50, select: { _id: 1 } }),
      ]);
      if (ownerHits.length) textOr.push({ currentOwner: { $in: ownerHits.map((m) => m._id) } });
      if (blockHits.length) textOr.push({ block: { $in: blockHits.map((b) => b._id) } });
      if (streetHits.length) textOr.push({ street: { $in: streetHits.map((s) => s._id) } });
      query.$or = textOr;
    }

    const [plots, total] = await Promise.all([
      Plot.find(query, { skip, limit, sort: { createdAt: -1 } }),
      db.collection(Plot.collectionName).countDocuments(query),
    ]);

    const blockIds = [...new Set(plots.map((p) => p.block).filter(Boolean))];
    const streetIds = [...new Set(plots.map((p) => p.street).filter(Boolean))];
    const categoryIds = [...new Set(plots.map((p) => p.category).filter(Boolean))];
    const ownerIds = [...new Set(plots.map((p) => p.currentOwner).filter(Boolean))];

    const [blocks, streets, categories, owners] = await Promise.all([
      blockIds.length ? Block.find({ _id: { $in: blockIds } }) : [],
      streetIds.length ? Street.find({ _id: { $in: streetIds } }) : [],
      categoryIds.length ? PlotCategory.find({ _id: { $in: categoryIds } }) : [],
      ownerIds.length ? Member.find({ _id: { $in: ownerIds } }) : [],
    ]);

    const blockMap = new Map(blocks.map((b) => [b._id, b]));
    const streetMap = new Map(streets.map((s) => [s._id, s]));
    const categoryMap = new Map(categories.map((c) => [c._id, c]));
    const ownerMap = new Map(owners.map((o) => [o._id, o]));

    const data = plots.map((plot) => ({
      ...plot,
      blockRef: blockMap.get(plot.block) || null,
      streetRef: streetMap.get(plot.street) || null,
      categoryRef: categoryMap.get(plot.category) || null,
      currentOwnerRef: plot.currentOwner ? ownerMap.get(plot.currentOwner) || null : null,
    }));

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 0 },
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