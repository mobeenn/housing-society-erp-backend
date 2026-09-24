const { db } = require("../../config/db");
const { ATTENDANCE_STATUSES } = require("./security.config");

/**
 * DutyRoster Model (SRS Section 18)
 * { guard (ref Guard), date (YYYY-MM-DD), shift (Morning/Evening/Night),
 *   attendanceStatus (Present/Absent/Leave — null until marked) }
 *
 * One entry per guard per date — assigning a shift or marking attendance
 * for the same guard+date upserts this record.
 */
class DutyRoster {
  static collectionName = "dutyRoster";

  static ATTENDANCE = ATTENDANCE_STATUSES;

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findOne(query = {}) {
    return db.collection(this.collectionName).findOne(query);
  }

  static async count(query = {}) {
    return db.collection(this.collectionName).countDocuments(query);
  }

  static async create(data, createdBy) {
    return db.collection(this.collectionName).insertOne({
      guard: data.guard,
      date: data.date, // YYYY-MM-DD
      shift: data.shift,
      attendanceStatus: data.attendanceStatus || null, // null until marked
      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

module.exports = { DutyRoster };