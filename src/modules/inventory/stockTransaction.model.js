const { db } = require("../../config/db");

class StockTransaction {
  static collectionName = "stockTransactions";

  static TYPES = { IN: "IN", OUT: "OUT", ADJUST: "ADJUST" };

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findOne(query = {}) {
    return db.collection(this.collectionName).findOne(query);
  }

  static async create(data) {
    const now = new Date().toISOString();
    return db.collection(this.collectionName).insertOne({
      item: data.item,
      type: data.type,
      quantity: Number(data.quantity),
      reference: data.reference || null,
      remarks: data.remarks || null,
      balanceAfter: data.balanceAfter != null ? Number(data.balanceAfter) : null,
      createdBy: data.createdBy || null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

module.exports = StockTransaction;
