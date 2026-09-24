const { db } = require("../../config/db");

class PlotMerge {
  static collectionName = "plotMerges";

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

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      mergedPlots: data.mergedPlots || [],
      resultingPlot: data.resultingPlot,
      adjustedAmounts: data.adjustedAmounts || [],
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

module.exports = PlotMerge;
