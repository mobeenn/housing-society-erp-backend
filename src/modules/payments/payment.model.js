const { db } = require("../../config/db");
const NumberingRule = require("../administration/numberingRule.model");

class Payment {
  static collectionName = "payments";
  static STATUS = { COMPLETED: "Completed", REVERSED: "Reversed" };
  static METHODS = ["Cash", "Cheque", "BankTransfer", "Online"];
  static async find(query = {}, options = {}) { return db.collection(this.collectionName).find(query, options); }
  static async findById(id) { return db.collection(this.collectionName).findOne({ _id: id }); }
  static async create(data) {
    const receiptNumber = await NumberingRule.getNextNumber("receipt");
    return db.collection(this.collectionName).insertOne({ receiptNumber, ...data, status: Payment.STATUS.COMPLETED });
  }
}

class Refund {
  static collectionName = "refunds";
  static STATUS = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", PAID: "Paid" };
  static async find(query = {}, options = {}) { return db.collection(this.collectionName).find(query, options); }
  static async findById(id) { return db.collection(this.collectionName).findOne({ _id: id }); }
  static async create(data) { return db.collection(this.collectionName).insertOne({ ...data, approvedBy: null, status: Refund.STATUS.PENDING }); }
  static async update(id, data) { return db.collection(this.collectionName).updateOne({ _id: id }, data); }
}

module.exports = { Payment, Refund };