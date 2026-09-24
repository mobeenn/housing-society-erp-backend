const { db } = require("../../config/db");
const NumberingRule = require("../administration/numberingRule.model");

class Invoice {
  static collectionName = "invoices";

  static TYPES = [
    "Booking",
    "Installment",
    "Transfer",
    "NOC",
    "Possession",
    "Construction",
    "PlotMerge",
    "BuyBack",
    "Expense",
    "OtherTransaction",
    "VendorCommission",
  ];

  static STATUS = {
    ACTIVE: "Active",
    CANCELLED: "Cancelled",
  };

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findOne(query) {
    return db.collection(this.collectionName).findOne(query);
  }

  static async findById(id) {
    return this.findOne({ _id: id });
  }

  static async findBySource(invoiceType, relatedEntityType, relatedEntityId) {
    return this.findOne({
      invoiceType,
      relatedEntityType,
      relatedEntityId,
    });
  }

  static async findBySourceKey(sourceKey) {
    return this.findOne({ sourceKey });
  }

  static async create(data) {
    const invoiceNumber = data.invoiceNumber || await NumberingRule.getNextNumber(NumberingRule.ENTITY_TYPES.INVOICE);
    return db.collection(this.collectionName).insertOne({
      invoiceNumber,
      invoiceType: data.invoiceType || "OtherTransaction",
      relatedEntityType: data.relatedEntityType || null,
      relatedEntityId: data.relatedEntityId || null,
      sourceKey: data.sourceKey || null,
      member: data.member || null,
      dealer: data.dealer || null,
      plot: data.plot || null,
      amount: Number(data.amount || 0),
      issueDate: data.issueDate || new Date().toISOString(),
      fileUrl: data.fileUrl || null,
      status: data.status || this.STATUS.ACTIVE,
      createdBy: data.createdBy || null,
      cancelledAt: data.cancelledAt || null,
      cancelledBy: data.cancelledBy || null,
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne({ _id: id }, patch);
  }

  static async count(query = {}) {
    return db.collection(this.collectionName).countDocuments(query);
  }
}

module.exports = Invoice;
