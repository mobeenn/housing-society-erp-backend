const { db } = require("../../config/db");

class TransferRequest {
  static collectionName = "transferRequests";
  static STATUS = { DRAFT: "Draft", PENDING_VERIFICATION: "PendingVerification", PENDING_APPROVAL: "PendingApproval", APPROVED: "Approved", REJECTED: "Rejected", COMPLETED: "Completed" };
  static async find(query = {}, options = {}) { return db.collection(this.collectionName).find(query, options); }
  static async findById(id) { return db.collection(this.collectionName).findOne({ _id: id }); }
  static async create(data, createdBy) { return db.collection(this.collectionName).insertOne({ ...data, status: TransferRequest.STATUS.DRAFT, duesCleared: false, approvalStages: [{ stage: "Verification", approver: null, status: "Pending", actedAt: null, remarks: null }, { stage: "Approval", approver: null, status: "Pending", actedAt: null, remarks: null }], createdBy }); }
  static async update(id, data) { return db.collection(this.collectionName).updateOne({ _id: id }, data); }
}

module.exports = TransferRequest;