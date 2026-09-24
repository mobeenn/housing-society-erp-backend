const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "purchaseRequests";

class PurchaseRequest {
  static get collectionName() {
    return collectionName;
  }

  static STATUSES = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    COMPLETED: "Completed",
  };

  static PRIORITIES = {
    HIGH: "High",
    NORMAL: "Normal",
    LOW: "Low",
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
    const purchaseRequest = {
      _id: uuidv4(),
      requestNumber: data.requestNumber, // from numbering rule
      requestedBy: createdBy || data.requestedBy,
      department: data.department || null,

      // Item/service details
      itemDescription: data.itemDescription,
      quantity: data.quantity || 1,
      estimatedCost: data.estimatedCost || null,

      justification: data.justification,
      requiredDate: data.requiredDate || null,
      priority: data.priority || "Normal", // High, Normal, Low

      status: data.status || PurchaseRequest.STATUSES.PENDING,

      // Approval workflow
      approvedBy: data.approvedBy || null,
      approvedAt: data.approvedAt || null,
      rejectionReason: data.rejectionReason || null,

      // Linked documents
      documents: data.documents || [],

      remarks: data.remarks || null,

      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(purchaseRequest);
    return { ...purchaseRequest, _id: result.insertedId || purchaseRequest._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }
}

module.exports = PurchaseRequest;
