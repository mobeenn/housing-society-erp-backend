const { db } = require("../../config/db");

class Appointment {
  static collectionName = "appointments";

  static STATUS = {
    WAITING: "Waiting",
    IN_MEETING: "InMeeting",
    DONE: "Done",
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

  static async findByToken(tokenNumber) {
    return this.findOne({ tokenNumber });
  }

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      visitorName: data.visitorName,
      purpose: data.purpose,
      hostEmployee: data.hostEmployee,
      tokenNumber: data.tokenNumber,
      status: data.status || this.STATUS.WAITING,
      checkInTime: data.checkInTime || null,
      checkOutTime: data.checkOutTime || null,
      createdBy: data.createdBy || null,
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne({ _id: id }, patch);
  }
}

module.exports = Appointment;
