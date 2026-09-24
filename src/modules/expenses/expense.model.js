const { db } = require("../../config/db");

class Expense {
  static collectionName = "expenses";
  static STATUS = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", PAID: "Paid" };
  static INDEXES = ["date", "status", "category"];
  static async find(query = {}, options = {}) { return db.collection(this.collectionName).find(query, options); }
  static async findById(id) { return db.collection(this.collectionName).findOne({ _id: id }); }
  static async create(data, createdBy) { return db.collection(this.collectionName).insertOne({ ...data, amount: Number(data.amount), date: data.date || new Date().toISOString(), approvedBy: null, status: Expense.STATUS.PENDING, createdBy }); }
  static async update(id, data) { return db.collection(this.collectionName).updateOne({ _id: id }, data); }
}

module.exports = Expense;