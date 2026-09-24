const { db } = require("../../config/db");

class RegistryBatch {
  static collectionName = "registryBatches";

  static STATUS = {
    REQUESTED: "Requested",
    COMPLETED: "Completed",
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
      plots: data.plots || [],
      requestDate: data.requestDate || new Date().toISOString().slice(0, 10),
      status: data.status || this.STATUS.REQUESTED,
      completedDate: data.completedDate || null,
      remarks: data.remarks || null,
      createdBy: data.createdBy || null,
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne({ _id: id }, patch);
  }
}

module.exports = RegistryBatch;
