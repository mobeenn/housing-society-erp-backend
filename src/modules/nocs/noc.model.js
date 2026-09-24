const crypto = require("crypto");
const { db } = require("../../config/db");
const NumberingRule = require("../administration/numberingRule.model");

class NocApplication {
  static collectionName = "nocApplications";
  static TYPES = ["Transfer", "Construction", "Sale", "Mortgage", "Utility", "Clearance", "Possession"];
  static STATUS = { APPLIED: "Applied", UNDER_VERIFICATION: "UnderVerification", DUES_PENDING: "DuesPending", APPROVED: "Approved", ISSUED: "Issued", REJECTED: "Rejected" };
  static async find(query = {}, options = {}) { return db.collection(this.collectionName).find(query, options); }
  static async findById(id) { return db.collection(this.collectionName).findOne({ _id: id }); }
  static async findByToken(token) { return db.collection(this.collectionName).findOne({ qrVerificationToken: token }); }
  static async create(data, createdBy) { return db.collection(this.collectionName).insertOne({ ...data, status: NocApplication.STATUS.APPLIED, issuedNocNumber: null, issuedDate: null, qrVerificationToken: null, createdBy, approvalStages: [{ stage: "Verification", status: "Pending", approver: null, actedAt: null, remarks: null }, { stage: "Dues", status: "Pending", approver: null, actedAt: null, remarks: null }, { stage: "Fee", status: "Pending", approver: null, actedAt: null, remarks: null }, { stage: "Approval", status: "Pending", approver: null, actedAt: null, remarks: null }, { stage: "Issue", status: "Pending", approver: null, actedAt: null, remarks: null }] }); }
  static async update(id, data) { return db.collection(this.collectionName).updateOne({ _id: id }, data); }
  static createToken() { return crypto.randomBytes(32).toString("hex"); }
}
module.exports = NocApplication;