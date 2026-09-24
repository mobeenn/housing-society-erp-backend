const { db } = require("../../config/db");

class InventoryItem {
  static collectionName = "inventoryItems";

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async create(data) {
    const now = new Date().toISOString();
    return db.collection(this.collectionName).insertOne({
      sku: data.sku,
      name: data.name,
      category: data.category || "General",
      unit: data.unit || "unit",
      quantity: Number(data.quantity || 0),
      reorderLevel: Number(data.reorderLevel || 0),
      status: data.status || "Active",
      createdAt: now,
      updatedAt: now,
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne(
      { _id: id },
      { ...patch, updatedAt: new Date().toISOString() }
    );
  }
}

module.exports = InventoryItem;
