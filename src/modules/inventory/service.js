const InventoryItem = require("./model");
const StockTransaction = require("./stockTransaction.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");

function decorate(item) {
  return {
    ...item,
    lowStock: Number(item.quantity || 0) <= Number(item.reorderLevel || 0),
    shortage: Math.max(0, Number(item.reorderLevel || 0) - Number(item.quantity || 0)),
  };
}

class InventoryService {
  static async list({ q, lowStockOnly, page, limit } = {}) {
    const { paginate } = require("../../utils/paginate");
    let items = await InventoryItem.find({}, { sort: { name: 1 } });
    if (q) {
      const needle = String(q).trim().toLowerCase();
      items = items.filter(
        (item) =>
          String(item.name || "").toLowerCase().includes(needle) ||
          String(item.sku || "").toLowerCase().includes(needle) ||
          String(item.category || "").toLowerCase().includes(needle)
      );
    }
    let decorated = items.map(decorate);
    if (lowStockOnly === true || lowStockOnly === "true" || lowStockOnly === "1") {
      decorated = decorated.filter((item) => item.lowStock);
    }
    return paginate(decorated, { page, limit });
  }

  static async lowStock() {
    const result = await this.list({ lowStockOnly: true, page: 1, limit: 100 });
    return {
      generatedAt: new Date().toISOString(),
      count: result.pagination.total,
      items: result.data,
    };
  }

  static async get(id) {
    const item = await InventoryItem.findById(id);
    if (!item) throw new ApiError(404, "Inventory item not found");
    const history = await StockTransaction.find({ item: id }, { sort: { createdAt: -1 }, limit: 50 });
    return { ...decorate(item), history };
  }

  static async create(data, req) {
    const sku = String(data.sku).trim();
    const existing = await InventoryItem.find({ sku });
    if (existing.some((row) => String(row.sku).toLowerCase() === sku.toLowerCase())) {
      throw new ApiError(409, `An item with SKU ${sku} already exists`);
    }
    const item = await InventoryItem.create({
      sku,
      name: data.name,
      category: data.category,
      unit: data.unit,
      quantity: data.quantity ?? 0,
      reorderLevel: data.reorderLevel ?? 0,
      status: data.status,
    });
    if (Number(item.quantity) > 0) {
      await StockTransaction.create({
        item: item._id,
        type: StockTransaction.TYPES.IN,
        quantity: Number(item.quantity),
        reference: `create:${item._id}`,
        remarks: "Opening stock",
        balanceAfter: Number(item.quantity),
        createdBy: req.user._id,
      });
    }
    await createAuditLog({
      req,
      entityType: "InventoryItem",
      entityId: item._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: item },
    });
    return decorate(item);
  }

  static async update(id, data, req) {
    const item = await InventoryItem.findById(id);
    if (!item) throw new ApiError(404, "Inventory item not found");
    if (data.sku && String(data.sku).trim().toLowerCase() !== String(item.sku || "").toLowerCase()) {
      const sku = String(data.sku).trim();
      const existing = await InventoryItem.find({ sku });
      if (existing.some((row) => row._id !== id && String(row.sku).toLowerCase() === sku.toLowerCase())) {
        throw new ApiError(409, `An item with SKU ${sku} already exists`);
      }
    }
    const patch = { ...data };
    delete patch.quantity; // quantity changes only via adjust
    await InventoryItem.update(id, patch);
    const updated = await InventoryItem.findById(id);
    await createAuditLog({
      req,
      entityType: "InventoryItem",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: item, after: updated },
    });
    return decorate(updated);
  }

  static async adjust(id, { type, quantity, reason }, req) {
    const item = await InventoryItem.findById(id);
    if (!item) throw new ApiError(404, "Inventory item not found");

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, "Quantity must be a positive number");

    let nextQty = Number(item.quantity || 0);
    if (type === "IN") nextQty += qty;
    else if (type === "OUT") {
      if (qty > nextQty) throw new ApiError(409, "Cannot take out more stock than is available");
      nextQty -= qty;
    } else if (type === "ADJUST") {
      nextQty = qty; // absolute set
    } else {
      throw new ApiError(400, "Invalid adjustment type");
    }

    const deltaQty = type === "ADJUST" ? Math.abs(nextQty - Number(item.quantity || 0)) : qty;

    await InventoryItem.update(id, { quantity: nextQty });
    const updated = await InventoryItem.findById(id);
    const txn = await StockTransaction.create({
      item: id,
      type: type === "ADJUST" ? StockTransaction.TYPES.ADJUST : type,
      quantity: type === "ADJUST" ? deltaQty || qty : qty,
      reference: null,
      remarks: reason,
      balanceAfter: nextQty,
      createdBy: req.user._id,
    });

    await createAuditLog({
      req,
      entityType: "InventoryItem",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: item, after: updated },
      meta: { adjustment: { type, quantity: qty, reason, transactionId: txn._id } },
    });

    return { ...decorate(updated), lastTransaction: txn };
  }

  static async history(id) {
    const item = await InventoryItem.findById(id);
    if (!item) throw new ApiError(404, "Inventory item not found");
    return StockTransaction.find({ item: id }, { sort: { createdAt: -1 }, limit: 100 });
  }

  /**
   * Apply GRN stock increase (idempotent per GRN + item).
   * Used by procurement GRN create.
   */
  static async applyGrnReceipt({ itemId, sku, name, unit, quantity, grnId, createdBy }) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return null;

    let item = itemId ? await InventoryItem.findById(itemId) : null;
    if (!item && sku) {
      const bySku = await InventoryItem.find({ sku });
      item = bySku.find((row) => String(row.sku).toLowerCase() === String(sku).toLowerCase()) || null;
    }
    if (!item && name) {
      const byName = await InventoryItem.find({ name });
      item = byName.find((row) => String(row.name).toLowerCase() === String(name).toLowerCase()) || null;
    }
    if (!item) {
      item = await InventoryItem.create({
        sku: sku || `SKU-${Date.now()}`,
        name: name || sku || "Received item",
        unit: unit || "unit",
        quantity: 0,
        reorderLevel: 0,
      });
    }

    const reference = `grn:${grnId}:${item._id}`;
    const existingTxn = await StockTransaction.findOne({ reference });
    if (existingTxn) return { item: decorate(item), transaction: existingTxn, skipped: true };

    const nextQty = Number(item.quantity || 0) + qty;
    await InventoryItem.update(item._id, { quantity: nextQty });
    const updated = await InventoryItem.findById(item._id);
    const transaction = await StockTransaction.create({
      item: item._id,
      type: StockTransaction.TYPES.IN,
      quantity: qty,
      reference,
      remarks: `Goods received (GRN ${grnId})`,
      balanceAfter: nextQty,
      createdBy,
    });
    return { item: decorate(updated), transaction, skipped: false };
  }
}

module.exports = InventoryService;
