const { db } = require("../../config/db");

class PayrollRun {
  static collectionName = "payrollRuns";

  static STATUS = {
    DRAFT: "Draft",
    APPROVED: "Approved",
    PAID: "Paid",
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

  static async findByPeriod(year, month) {
    return this.findOne({ year: Number(year), month: Number(month) });
  }

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      month: Number(data.month),
      year: Number(data.year),
      status: data.status || this.STATUS.DRAFT,
      generatedBy: data.generatedBy || null,
      approvedBy: data.approvedBy || null,
      paidBy: data.paidBy || null,
      approvedAt: data.approvedAt || null,
      paidAt: data.paidAt || null,
      journalEntryId: data.journalEntryId || null,
      entries: data.entries || [],
      totals: data.totals || {},
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne({ _id: id }, patch);
  }
}

module.exports = PayrollRun;
