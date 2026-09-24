const { db } = require("../../config/db");

class RecoveryAssignment {
  static collectionName = "recoveryAssignments";

  static STATUS = {
    ASSIGNED: "Assigned",
    IN_PROGRESS: "InProgress",
    RESOLVED: "Resolved",
    REASSIGNED: "Reassigned",
  };

  static ACTIVE_STATUSES = [
    this.STATUS.ASSIGNED,
    this.STATUS.IN_PROGRESS,
  ];

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async findByBooking(booking) {
    return this.find({ booking }, { sort: { assignedDate: -1 } });
  }

  static async findActiveByBooking(booking) {
    const assignments = await this.findByBooking(booking);
    return assignments.find((assignment) => this.ACTIVE_STATUSES.includes(assignment.status)) || null;
  }

  static async findByAgent(agent) {
    return this.find({ agent }, { sort: { assignedDate: -1 } });
  }

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      booking: data.booking,
      agent: data.agent,
      assignedBy: data.assignedBy,
      assignedDate: data.assignedDate || new Date().toISOString(),
      status: data.status || this.STATUS.ASSIGNED,
      recoveryPercent: Number(data.recoveryPercent || 0),
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne({ _id: id }, patch);
  }
}

class RecoveryCall {
  static collectionName = "recoveryCalls";

  static OUTCOMES = [
    "Connected",
    "NoAnswer",
    "PromiseToPay",
    "Paid",
    "Escalated",
    "WrongNumber",
    "Other",
  ];

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async findByAssignment(assignment) {
    return this.find({ assignment }, { sort: { callDate: -1 } });
  }

  static async findByCalledBy(calledBy) {
    return this.find({ calledBy }, { sort: { callDate: -1 } });
  }

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      assignment: data.assignment,
      calledBy: data.calledBy,
      callDate: data.callDate || new Date().toISOString(),
      notes: data.notes || null,
      commitmentDate: data.commitmentDate || null,
      commitmentAmount: data.commitmentAmount === undefined || data.commitmentAmount === null
        ? null
        : Number(data.commitmentAmount),
      outcome: data.outcome || "Connected",
    });
  }
}

module.exports = { RecoveryAssignment, RecoveryCall };
