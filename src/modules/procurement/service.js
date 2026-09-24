const Vendor = require("./vendor.model");
const PurchaseRequest = require("./purchaseRequest.model");
const Quotation = require("./quotation.model");
const PurchaseOrder = require("./purchaseOrder.model");
const GRN = require("./grn.model");
const User = require("../auth/user.model");
const NumberingRule = require("../administration/numberingRule.model");
const { createAuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");

/** Enrich vendor with computed outstanding balance */
const enrichVendor = async (vendor) => {
  const outstandingBalance = await Vendor.computeOutstandingBalance(vendor._id);
  return { ...vendor, outstandingBalance };
};

/** Enrich purchase request with user references */
const enrichPurchaseRequest = async (pr) => {
  const [requestedBy, approvedBy] = await Promise.all([
    pr.requestedBy ? User.findById(pr.requestedBy) : null,
    pr.approvedBy ? User.findById(pr.approvedBy) : null,
  ]);
  return { ...pr, requestedByRef: requestedBy, approvedByRef: approvedBy };
};

/** Enrich quotation with vendor and purchase request references */
const enrichQuotation = async (quotation) => {
  const [vendor, purchaseRequest] = await Promise.all([
    Vendor.findById(quotation.vendor),
    PurchaseRequest.findById(quotation.purchaseRequest),
  ]);
  return { ...quotation, vendorRef: vendor, purchaseRequestRef: purchaseRequest };
};

/** Enrich purchase order with references */
const enrichPurchaseOrder = async (po) => {
  const [vendor, purchaseRequest, quotation] = await Promise.all([
    Vendor.findById(po.selectedVendor),
    PurchaseRequest.findById(po.purchaseRequest),
    po.selectedQuotation ? Quotation.findById(po.selectedQuotation) : null,
  ]);
  return { ...po, vendorRef: vendor, purchaseRequestRef: purchaseRequest, quotationRef: quotation };
};

/** Enrich GRN with references */
const enrichGRN = async (grn) => {
  const [purchaseOrder, vendor, receivedBy] = await Promise.all([
    PurchaseOrder.findById(grn.purchaseOrder),
    Vendor.findById(grn.vendor),
    grn.receivedBy ? User.findById(grn.receivedBy) : null,
  ]);
  return { ...grn, purchaseOrderRef: purchaseOrder, vendorRef: vendor, receivedByRef: receivedBy };
};

// ========== Vendor Service ==========
class VendorService {
  static async list({ q, category, status, page = 1, limit = 50 } = {}) {
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;

    const all = await Vendor.find(query, { sort: { createdAt: -1 } });

    const filtered = q
      ? all.filter((v) =>
          [v.name, v.contactPerson, v.phone, v.email, v.taxId, v.ntn]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(String(q).toLowerCase())
        )
      : all;

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = filtered.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((v) => enrichVendor(v))),
      pagination: {
        page: p,
        limit: l,
        total: filtered.length,
        pages: Math.ceil(filtered.length / l),
      },
    };
  }

  static async get(id) {
    const vendor = await Vendor.findById(id);
    if (!vendor) throw new ApiError(404, "Vendor not found");
    return enrichVendor(vendor);
  }

  static async create(data, req) {
    const existing = await Vendor.findOne({ name: data.name });
    if (existing) throw new ApiError(400, "Vendor with this name already exists");

    const vendor = await Vendor.create(data, req.user._id);

    await createAuditLog({
      action: "create",
      entity: "vendor",
      entityId: vendor._id,
      changes: { created: vendor },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return enrichVendor(vendor);
  }

  static async update(id, patch, req) {
    const vendor = await Vendor.findById(id);
    if (!vendor) throw new ApiError(404, "Vendor not found");

    await Vendor.update(id, patch);

    await createAuditLog({
      action: "update",
      entity: "vendor",
      entityId: id,
      changes: { before: vendor, after: patch },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const updated = await Vendor.findById(id);
    return enrichVendor(updated);
  }

  static async delete(id, req) {
    const vendor = await Vendor.findById(id);
    if (!vendor) throw new ApiError(404, "Vendor not found");

    // Check for linked purchase orders
    const linkedPOs = await PurchaseOrder.find({ selectedVendor: id });
    if (linkedPOs.length > 0) {
      throw new ApiError(400, "Cannot delete vendor with linked purchase orders");
    }

    await Vendor.delete(id);

    await createAuditLog({
      action: "delete",
      entity: "vendor",
      entityId: id,
      changes: { deleted: vendor },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return { message: "Vendor deleted successfully" };
  }

  static async getPurchaseHistory(vendorId) {
    const purchaseOrders = await PurchaseOrder.find({ selectedVendor: vendorId }, { sort: { createdAt: -1 } });
    return Promise.all(purchaseOrders.map((po) => enrichPurchaseOrder(po)));
  }
}

// ========== Purchase Request Service ==========
class PurchaseRequestService {
  static async list({ status, department, requestedBy, page = 1, limit = 50 } = {}) {
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (requestedBy) query.requestedBy = requestedBy;

    const all = await PurchaseRequest.find(query, { sort: { createdAt: -1 } });

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = all.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((pr) => enrichPurchaseRequest(pr))),
      pagination: {
        page: p,
        limit: l,
        total: all.length,
        pages: Math.ceil(all.length / l),
      },
    };
  }

  static async get(id) {
    const pr = await PurchaseRequest.findById(id);
    if (!pr) throw new ApiError(404, "Purchase request not found");
    return enrichPurchaseRequest(pr);
  }

  static async create(data, req) {
    const requestNumber = await NumberingRule.getNextNumber("purchaseRequest");

    const pr = await PurchaseRequest.create({ ...data, requestNumber }, req.user._id);

    await createAuditLog({
      action: "create",
      entity: "purchaseRequest",
      entityId: pr._id,
      changes: { created: pr },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return enrichPurchaseRequest(pr);
  }

  static async update(id, patch, req) {
    const pr = await PurchaseRequest.findById(id);
    if (!pr) throw new ApiError(404, "Purchase request not found");

    // Status transitions
    if (patch.status === PurchaseRequest.STATUSES.APPROVED) {
      patch.approvedBy = req.user._id;
      patch.approvedAt = new Date().toISOString();
    }

    await PurchaseRequest.update(id, patch);

    await createAuditLog({
      action: "update",
      entity: "purchaseRequest",
      entityId: id,
      changes: { before: pr, after: patch },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const updated = await PurchaseRequest.findById(id);
    return enrichPurchaseRequest(updated);
  }

  static async delete(id, req) {
    const pr = await PurchaseRequest.findById(id);
    if (!pr) throw new ApiError(404, "Purchase request not found");

    // Cannot delete if quotations or POs exist
    const quotations = await Quotation.find({ purchaseRequest: id });
    if (quotations.length > 0) {
      throw new ApiError(400, "Cannot delete purchase request with linked quotations");
    }

    await PurchaseRequest.delete(id);

    await createAuditLog({
      action: "delete",
      entity: "purchaseRequest",
      entityId: id,
      changes: { deleted: pr },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return { message: "Purchase request deleted successfully" };
  }
}

// ========== Quotation Service ==========
class QuotationService {
  static async list({ purchaseRequest, vendor, status, page = 1, limit = 50 } = {}) {
    const query = {};
    if (purchaseRequest) query.purchaseRequest = purchaseRequest;
    if (vendor) query.vendor = vendor;
    if (status) query.status = status;

    const all = await Quotation.find(query, { sort: { createdAt: -1 } });

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = all.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((q) => enrichQuotation(q))),
      pagination: {
        page: p,
        limit: l,
        total: all.length,
        pages: Math.ceil(all.length / l),
      },
    };
  }

  static async get(id) {
    const quotation = await Quotation.findById(id);
    if (!quotation) throw new ApiError(404, "Quotation not found");
    return enrichQuotation(quotation);
  }

  static async create(data, req) {
    // Verify purchase request exists
    const pr = await PurchaseRequest.findById(data.purchaseRequest);
    if (!pr) throw new ApiError(404, "Purchase request not found");

    // Verify vendor exists
    const vendor = await Vendor.findById(data.vendor);
    if (!vendor) throw new ApiError(404, "Vendor not found");

    const quotationNumber = await NumberingRule.getNextNumber("quotation");

    const quotation = await Quotation.create({ ...data, quotationNumber }, req.user._id);

    await createAuditLog({
      action: "create",
      entity: "quotation",
      entityId: quotation._id,
      changes: { created: quotation },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return enrichQuotation(quotation);
  }

  static async update(id, patch, req) {
    const quotation = await Quotation.findById(id);
    if (!quotation) throw new ApiError(404, "Quotation not found");

    await Quotation.update(id, patch);

    await createAuditLog({
      action: "update",
      entity: "quotation",
      entityId: id,
      changes: { before: quotation, after: patch },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const updated = await Quotation.findById(id);
    return enrichQuotation(updated);
  }

  static async delete(id, req) {
    const quotation = await Quotation.findById(id);
    if (!quotation) throw new ApiError(404, "Quotation not found");

    // Cannot delete selected quotation
    if (quotation.status === Quotation.STATUSES.SELECTED) {
      throw new ApiError(400, "Cannot delete selected quotation");
    }

    await Quotation.delete(id);

    await createAuditLog({
      action: "delete",
      entity: "quotation",
      entityId: id,
      changes: { deleted: quotation },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return { message: "Quotation deleted successfully" };
  }
}

// ========== Purchase Order Service ==========
class PurchaseOrderService {
  static async list({ purchaseRequest, vendor, status, page = 1, limit = 50 } = {}) {
    const query = {};
    if (purchaseRequest) query.purchaseRequest = purchaseRequest;
    if (vendor) query.selectedVendor = vendor;
    if (status) query.status = status;

    const all = await PurchaseOrder.find(query, { sort: { createdAt: -1 } });

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = all.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((po) => enrichPurchaseOrder(po))),
      pagination: {
        page: p,
        limit: l,
        total: all.length,
        pages: Math.ceil(all.length / l),
      },
    };
  }

  static async get(id) {
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new ApiError(404, "Purchase order not found");
    return enrichPurchaseOrder(po);
  }

  static async create(data, req) {
    // Verify purchase request exists and is approved
    const pr = await PurchaseRequest.findById(data.purchaseRequest);
    if (!pr) throw new ApiError(404, "Purchase request not found");
    if (pr.status !== PurchaseRequest.STATUSES.APPROVED) {
      throw new ApiError(400, "Purchase request must be approved before creating PO");
    }

    // Verify vendor exists
    const vendor = await Vendor.findById(data.selectedVendor);
    if (!vendor) throw new ApiError(404, "Vendor not found");

    // If quotation provided, verify it exists and mark as selected
    if (data.selectedQuotation) {
      const quotation = await Quotation.findById(data.selectedQuotation);
      if (!quotation) throw new ApiError(404, "Quotation not found");

      await Quotation.update(data.selectedQuotation, { status: Quotation.STATUSES.SELECTED });
    }

    const poNumber = await NumberingRule.getNextNumber("purchaseOrder");

    const po = await PurchaseOrder.create({ ...data, poNumber }, req.user._id);

    await createAuditLog({
      action: "create",
      entity: "purchaseOrder",
      entityId: po._id,
      changes: { created: po },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return enrichPurchaseOrder(po);
  }

  static async update(id, patch, req) {
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new ApiError(404, "Purchase order not found");

    // Status transitions
    if (patch.status === PurchaseOrder.STATUSES.APPROVED) {
      patch.approvedBy = req.user._id;
      patch.approvedAt = new Date().toISOString();
    } else if (patch.status === PurchaseOrder.STATUSES.SENT) {
      patch.sentAt = new Date().toISOString();
    } else if (patch.status === PurchaseOrder.STATUSES.COMPLETED) {
      patch.completedAt = new Date().toISOString();
    } else if (patch.status === PurchaseOrder.STATUSES.CANCELLED) {
      patch.cancelledAt = new Date().toISOString();
    }

    await PurchaseOrder.update(id, patch);

    await createAuditLog({
      action: "update",
      entity: "purchaseOrder",
      entityId: id,
      changes: { before: po, after: patch },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const updated = await PurchaseOrder.findById(id);
    return enrichPurchaseOrder(updated);
  }

  static async delete(id, req) {
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new ApiError(404, "Purchase order not found");

    // Cannot delete if GRN exists
    const grns = await GRN.find({ purchaseOrder: id });
    if (grns.length > 0) {
      throw new ApiError(400, "Cannot delete purchase order with linked GRNs");
    }

    await PurchaseOrder.delete(id);

    await createAuditLog({
      action: "delete",
      entity: "purchaseOrder",
      entityId: id,
      changes: { deleted: po },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return { message: "Purchase order deleted successfully" };
  }
}

// ========== GRN Service ==========
class GRNService {
  static async list({ purchaseOrder, vendor, page = 1, limit = 50 } = {}) {
    const query = {};
    if (purchaseOrder) query.purchaseOrder = purchaseOrder;
    if (vendor) query.vendor = vendor;

    const all = await GRN.find(query, { sort: { createdAt: -1 } });

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = all.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((grn) => enrichGRN(grn))),
      pagination: {
        page: p,
        limit: l,
        total: all.length,
        pages: Math.ceil(all.length / l),
      },
    };
  }

  static async get(id) {
    const grn = await GRN.findById(id);
    if (!grn) throw new ApiError(404, "GRN not found");
    return enrichGRN(grn);
  }

  static async create(data, req) {
    // Verify purchase order exists
    const po = await PurchaseOrder.findById(data.purchaseOrder);
    if (!po) throw new ApiError(404, "Purchase order not found");

    const grnNumber = await NumberingRule.getNextNumber("grn");

    const grn = await GRN.create({ ...data, grnNumber, vendor: po.selectedVendor }, req.user._id);

    // Update purchase order status based on received quantities
    const allFullyReceived = grn.items.every((item) => item.receivedQty >= item.orderedQty);
    const anyPartiallyReceived = grn.items.some((item) => item.receivedQty > 0 && item.receivedQty < item.orderedQty);

    if (allFullyReceived) {
      await PurchaseOrder.update(data.purchaseOrder, {
        status: PurchaseOrder.STATUSES.COMPLETED,
        completedAt: new Date().toISOString(),
      });
    } else if (anyPartiallyReceived || grn.items.some((item) => item.receivedQty > 0)) {
      await PurchaseOrder.update(data.purchaseOrder, { status: PurchaseOrder.STATUSES.PARTIALLY_RECEIVED });
    }

    // TODO: Phase 7.3 - Trigger inventory stock increase here
    // for each item in grn.items where receivedQty > 0

    await createAuditLog({
      action: "create",
      entity: "grn",
      entityId: grn._id,
      changes: { created: grn },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return enrichGRN(grn);
  }

  static async update(id, patch, req) {
    const grn = await GRN.findById(id);
    if (!grn) throw new ApiError(404, "GRN not found");

    await GRN.update(id, patch);

    await createAuditLog({
      action: "update",
      entity: "grn",
      entityId: id,
      changes: { before: grn, after: patch },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const updated = await GRN.findById(id);
    return enrichGRN(updated);
  }

  static async delete(id, req) {
    const grn = await GRN.findById(id);
    if (!grn) throw new ApiError(404, "GRN not found");

    await GRN.delete(id);

    await createAuditLog({
      action: "delete",
      entity: "grn",
      entityId: id,
      changes: { deleted: grn },
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return { message: "GRN deleted successfully" };
  }
}

module.exports = {
  VendorService,
  PurchaseRequestService,
  QuotationService,
  PurchaseOrderService,
  GRNService,
};
