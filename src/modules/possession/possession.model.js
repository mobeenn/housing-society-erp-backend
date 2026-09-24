const { db } = require("../../config/db");
class PossessionApplication {
  static collectionName = "possessionApplications";
  static STATUS = { APPLIED: "Applied", UNDER_VERIFICATION: "UnderVerification", APPROVED: "Approved", POSSESSED: "Possessed" };
  static async find(query = {}, options = {}) { return db.collection(this.collectionName).find(query, options); }
  static async findById(id) { return db.collection(this.collectionName).findOne({ _id: id }); }
  static async create(data, createdBy) { return db.collection(this.collectionName).insertOne({ ...data, status: this.STATUS.APPLIED, eligibilityVerified: false, duesVerified: false, siteReadinessVerified: false, chargesPaid: false, handoverDate: null, possessionLetterUrl: null, createdBy, approvalStages: [{ stage: "Verification", status: "Pending", approver: null, actedAt: null, remarks: null }, { stage: "Charges", status: "Pending", approver: null, actedAt: null, remarks: null }, { stage: "Approval", status: "Pending", approver: null, actedAt: null, remarks: null }, { stage: "Possession", status: "Pending", approver: null, actedAt: null, remarks: null }] }); }
  static async update(id, data) { return db.collection(this.collectionName).updateOne({ _id: id }, data); }
}
module.exports = PossessionApplication;