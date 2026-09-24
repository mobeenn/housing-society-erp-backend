const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "goodsReceivedNotes";

class GRN {
  static get collectionName() {
    return collectionName;
  }

  static INSPECTION_STATUSES = {
    PASSED: "Passed",
    PARTIALLY_PASSED: "PartiallyPassed",
    FAILED: "Failed",
  };

  static async find(query = {}, options = {}) {
    return db.collection(collectionName).find(query, options);
  }

  static async findOne(query) {
    return db.collection(collectionName).findOne(query);
  }

  static async findById(id) {
    return db.collection(collectionName).findOne({ _id: id });
  }

  static async create(data, createdBy) {
    const grn = {
      _id: uuidv4(),
      grnNumber: data.grnNumber, // from numbering rule
      purchaseOrder: data.purchaseOrder, // ref PurchaseOrder
      vendor: data.vendor, // ref Vendor

      // Items received & QC
      items: data.items || [], // [{ item, orderedQty, receivedQty, rejectedQty, qualityCheckNote, remarks }]

      receivedBy: data.receivedBy || createdBy,
      date: data.date || new Date().toISOString().slice(0, 10),
      deliveryChallanNo: data.deliveryChallanNo || null,

      inspectionStatus: data.inspectionStatus || GRN.INSPECTION_STATUSES.PASSED,
      remarks: data.remarks || null,
      documents: data.documents || [],

      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(grn);
    return { ...grn, _id: result.insertedId || grn._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }
}

module.exports = GRN;
