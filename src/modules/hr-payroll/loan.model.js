const { db } = require("../../config/db");

class Loan {
  static collectionName = "loans";

  static STATUS = {
    ACTIVE: "Active",
    CLOSED: "Closed",
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

  static async findByEmployee(employee) {
    return this.find({ employee }, { sort: { disbursedDate: -1 } });
  }

  static async findActiveByEmployee(employee) {
    const loans = await this.findByEmployee(employee);
    return loans.filter((loan) => loan.status === this.STATUS.ACTIVE && Number(loan.remainingBalance) > 0);
  }

  static async create(data, createdBy = null) {
    const amount = Number(data.amount);
    return db.collection(this.collectionName).insertOne({
      employee: data.employee,
      amount,
      installmentAmount: Number(data.installmentAmount),
      remainingBalance: amount,
      status: data.status || this.STATUS.ACTIVE,
      disbursedDate: data.disbursedDate || new Date().toISOString(),
      createdBy,
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne({ _id: id }, patch);
  }

  static async close(id, closedBy = null) {
    return this.update(id, {
      status: this.STATUS.CLOSED,
      closedAt: new Date().toISOString(),
      closedBy,
    });
  }
}

module.exports = Loan;
