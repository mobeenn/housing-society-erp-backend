const { db } = require("../../config/db");

class BuyBack {
  static collectionName = "buybacks";

  static TYPE = {
    BUYBACK: "BuyBack",
    CANCEL: "Cancel",
  };

  static STATUS = {
    PENDING: "Pending",
    COMPLETED: "Completed",
    FAILED: "Failed",
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

  static async findActiveByBooking(booking) {
    const rows = await this.find({ booking }, { sort: { date: -1 } });
    return rows.find((row) => row.status === this.STATUS.PENDING || row.status === this.STATUS.COMPLETED) || null;
  }

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      plot: data.plot,
      booking: data.booking,
      type: data.type,
      paymentType: data.paymentType,
      deductionPercent: Number(data.deductionPercent || 0),
      settlementAmount: Number(data.settlementAmount || 0),
      performedBy: data.performedBy || null,
      date: data.date || new Date().toISOString(),
      status: data.status || this.STATUS.PENDING,
      invoiceId: data.invoiceId || null,
      invoiceUrl: data.invoiceUrl || null,
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne({ _id: id }, patch);
  }
}

module.exports = BuyBack;
