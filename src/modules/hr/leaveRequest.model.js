const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "leaveRequests";

class LeaveRequest {
  static get collectionName() {
    return collectionName;
  }

  static STATUSES = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };

  static LEAVE_TYPES = {
    ANNUAL: "Annual",
    SICK: "Sick",
    CASUAL: "Casual",
    UNPAID: "Unpaid",
    MATERNITY: "Maternity",
    PATERNITY: "Paternity",
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
    const leaveRequest = {
      _id: uuidv4(),
      employee: data.employee,
      type: data.type,
      fromDate: data.fromDate,
      toDate: data.toDate,
      reason: data.reason,
      status: data.status || LeaveRequest.STATUSES.PENDING,

      // Capture leave balance at time of request
      balanceSnapshot: data.balanceSnapshot || null,

      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,

      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(leaveRequest);
    return { ...leaveRequest, _id: result.insertedId || leaveRequest._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }
}

module.exports = LeaveRequest;
