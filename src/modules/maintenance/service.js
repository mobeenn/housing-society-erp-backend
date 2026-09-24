const { Asset } = require("./asset.model");
const { WorkOrder } = require("./workOrder.model");
const {
  STATUSES,
  canTransitionStatus,
  totalCost,
} = require("./maintenance.config");
const { Complaint } = require("../complaints/complaint.model");
const { Block } = require("../administration/masterData.model");
const User = require("../auth/user.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");

/** Shared enrichment for work orders — populates asset/complaint/staff/log authors. */
const enrichWorkOrder = async (workOrder) => {
  const authorIds = [...new Set((workOrder.progressLog || []).map((entry) => entry.author))];
  const [asset, complaint, staff, ...authors] = await Promise.all([
    workOrder.asset ? Asset.findById(workOrder.asset) : null,
    workOrder.relatedComplaint ? Complaint.findById(workOrder.relatedComplaint) : null,
    workOrder.assignedStaff ? User.findById(workOrder.assignedStaff) : null,
    ...authorIds.map((id) => User.findById(id)),
  ]);
  const authorMap = new Map(authorIds.map((id, i) => [id, authors[i]]));
  return {
    ...workOrder,
    assetRef: asset,
    relatedComplaintRef: complaint,
    assignedStaffRef: staff,
    progressLog: (workOrder.progressLog || []).map((entry) => ({
      ...entry,
      authorRef: authorMap.get(entry.author) || null,
    })),
    totalCost: totalCost(workOrder),
  };
};

class AssetService {
  static async list({ type, q } = {}) {
    const query = {};
    if (type) query.type = type;
    const all = await Asset.find(query, { sort: { name: 1 } });
    const matches = q
      ? all.filter((asset) =>
          [asset.name, asset.location, asset.type]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(String(q).toLowerCase())
        )
      : all;
    return { data: matches, pagination: { total: matches.length } };
  }

  static async get(id) {
    const asset = await Asset.findById(id);
    if (!asset) throw new ApiError(404, "Asset not found");
    return asset;
  }

  static async create(data, req) {
    if (data.block && !(await Block.findById(data.block))) {
      throw new ApiError(400, "Block not found");
    }
    const asset = await Asset.create(data, req.user._id);
    await createAuditLog({
      req,
      entityType: "Asset",
      entityId: asset._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: asset },
    });
    return asset;
  }

  static async update(id, data, req) {
    const asset = await this.get(id);
    if (data.block && !(await Block.findById(data.block))) {
      throw new ApiError(400, "Block not found");
    }
    const patch = { updatedAt: new Date().toISOString() };
    ["name", "type", "location", "block"].forEach((field) => {
      if (data[field] !== undefined) patch[field] = data[field];
    });
    await Asset.update(id, patch);
    await createAuditLog({
      req,
      entityType: "Asset",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: asset, after: patch },
    });
    return this.get(id);
  }

  /**
   * Full maintenance history for an asset (SRS Section 17):
   * the asset, every work order ever raised against it (newest first),
   * and a cost/status summary.
   */
  static async history(id) {
    const asset = await this.get(id);
    const workOrders = await WorkOrder.find({ asset: id }, { sort: { createdAt: -1 } });
    const enriched = await Promise.all(workOrders.map((wo) => enrichWorkOrder(wo)));
    const byStatus = {};
    Object.values(STATUSES).forEach((status) => {
      byStatus[status] = enriched.filter((wo) => wo.status === status).length;
    });
    return {
      asset,
      workOrders: enriched,
      summary: {
        total: enriched.length,
        byStatus,
        open: byStatus[STATUSES.OPEN] + byStatus[STATUSES.IN_PROGRESS],
        totalCost: enriched.reduce((sum, wo) => sum + Number(wo.totalCost || 0), 0),
      },
    };
  }
}

class WorkOrderService {
  static async enrich(workOrder) {
    return enrichWorkOrder(workOrder);
  }

  static async list({ status, priority, asset, relatedComplaint, page = 1, limit = 20 }) {
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (asset) query.asset = asset;
    if (relatedComplaint) query.relatedComplaint = relatedComplaint;
    const all = await WorkOrder.find(query, { sort: { createdAt: -1 } });
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    return {
      data: await Promise.all(all.slice((p - 1) * l, p * l).map((wo) => this.enrich(wo))),
      pagination: { page: p, limit: l, total: all.length, pages: Math.ceil(all.length / l) },
    };
  }

  static async get(id) {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) throw new ApiError(404, "Work order not found");
    return this.enrich(workOrder);
  }

  /** Create a work order — optionally spawned from a complaint and/or tied to an asset. */
  static async create(data, req) {
    if (data.asset && !(await Asset.findById(data.asset))) {
      throw new ApiError(400, "Asset not found");
    }
    if (data.relatedComplaint && !(await Complaint.findById(data.relatedComplaint))) {
      throw new ApiError(400, "Complaint not found");
    }
    if (data.assignedStaff && !(await User.findById(data.assignedStaff))) {
      throw new ApiError(400, "Staff user not found");
    }
    const workOrder = await WorkOrder.create(data, req.user._id);
    await createAuditLog({
      req,
      entityType: "WorkOrder",
      entityId: workOrder._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: workOrder },
    });
    return this.get(workOrder._id);
  }

  /** Edit a work order while it is still Open or InProgress. */
  static async update(id, data, req) {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) throw new ApiError(404, "Work order not found");
    if (![STATUSES.OPEN, STATUSES.IN_PROGRESS].includes(workOrder.status)) {
      throw new ApiError(409, `Cannot edit a work order in status ${workOrder.status}`);
    }
    if (data.asset && !(await Asset.findById(data.asset))) throw new ApiError(400, "Asset not found");
    if (data.assignedStaff && !(await User.findById(data.assignedStaff))) {
      throw new ApiError(400, "Staff user not found");
    }
    const patch = { updatedAt: new Date().toISOString() };
    ["description", "assignedStaff", "contractor", "priority", "expectedCompletion"].forEach(
      (field) => {
        if (data[field] !== undefined) patch[field] = data[field];
      }
    );
    if (data.materials !== undefined) {
      patch.materials = data.materials.map((material) => ({
        item: material.item,
        quantity: Number(material.quantity) || 0,
      }));
    }
    if (data.laborCost !== undefined) patch.laborCost = Number(data.laborCost) || 0;
    if (data.materialCost !== undefined) patch.materialCost = Number(data.materialCost) || 0;
    await WorkOrder.update(id, patch);
    await createAuditLog({
      req,
      entityType: "WorkOrder",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: workOrder, after: patch },
    });
    return this.get(id);
  }

  /**
   * Append an entry to the progress log. The first log entry on an Open
   * work order automatically moves it to InProgress.
   */
  static async logProgress(id, data, req) {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) throw new ApiError(404, "Work order not found");
    if (![STATUSES.OPEN, STATUSES.IN_PROGRESS].includes(workOrder.status)) {
      throw new ApiError(409, `Cannot log progress on a work order in status ${workOrder.status}`);
    }
    const entry = {
      note: data.note.trim(),
      author: req.user._id,
      date: new Date().toISOString(),
    };
    const patch = {
      progressLog: [...(workOrder.progressLog || []), entry],
      updatedAt: entry.date,
    };
    if (workOrder.status === STATUSES.OPEN) patch.status = STATUSES.IN_PROGRESS;
    await WorkOrder.update(id, patch);
    await createAuditLog({
      req,
      entityType: "WorkOrder",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { after: { progressLog: entry, status: patch.status } },
    });
    return this.get(id);
  }

  /** Generic status change with transition validation (e.g. Open -> InProgress). */
  static async changeStatus(id, data, req) {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) throw new ApiError(404, "Work order not found");
    if (data.status === STATUSES.COMPLETED) {
      throw new ApiError(409, "Use the complete endpoint to complete a work order");
    }
    if (!canTransitionStatus(workOrder.status, data.status)) {
      throw new ApiError(409, `Invalid status transition: ${workOrder.status} -> ${data.status}`);
    }
    const now = new Date().toISOString();
    const patch = { status: data.status, updatedAt: now };
    if (data.status === STATUSES.CANCELLED) {
      patch.progressLog = [
        ...(workOrder.progressLog || []),
        { note: `Work order cancelled${data.reason ? `: ${data.reason}` : ""}`, author: req.user._id, date: now },
      ];
    }
    await WorkOrder.update(id, patch);
    await createAuditLog({
      req,
      entityType: "WorkOrder",
      entityId: id,
      action: AuditLog.ACTIONS.STATUS_CHANGE,
      changes: { before: { status: workOrder.status }, after: { status: data.status } },
    });
    return this.get(id);
  }

  /** Mark a work order complete — requires a completion note. */
  static async complete(id, data, req) {
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) throw new ApiError(404, "Work order not found");
    if (!canTransitionStatus(workOrder.status, STATUSES.COMPLETED)) {
      throw new ApiError(409, `Cannot complete a work order in status ${workOrder.status}`);
    }
    if (!data.completionNote?.trim()) throw new ApiError(400, "Completion note is required");
    const completedAt = new Date().toISOString();
    await WorkOrder.update(id, {
      status: STATUSES.COMPLETED,
      completionNote: data.completionNote.trim(),
      completedAt,
      updatedAt: completedAt,
    });
    await createAuditLog({
      req,
      entityType: "WorkOrder",
      entityId: id,
      action: AuditLog.ACTIONS.STATUS_CHANGE,
      changes: { before: { status: workOrder.status }, after: { status: STATUSES.COMPLETED } },
    });
    return this.get(id);
  }

  /** Cancel an open / in-progress work order (optional reason is logged). */
  static async cancel(id, data, req) {
    return this.changeStatus(id, { status: STATUSES.CANCELLED, reason: data?.reason }, req);
  }
}

module.exports = { AssetService, WorkOrderService };