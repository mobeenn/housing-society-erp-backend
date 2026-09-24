const { db } = require("../../config/db");
const { SHIFTS, GUARD_STATUSES } = require("./security.config");

/**
 * Guard Model (SRS Section 18)
 * { user (ref User, optional — guards may log in), name, phone,
 *   supervisor (ref User), shift (Morning/Evening/Night), status }
 */
class Guard {
  static collectionName = "guards";

  static SHIFTS = SHIFTS;
  static STATUSES = GUARD_STATUSES;

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async count(query = {}) {
    return db.collection(this.collectionName).countDocuments(query);
  }

  static async create(data, createdBy) {
    return db.collection(this.collectionName).insertOne({
      user: data.user || null, // optional — guards without system logins stay null
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      supervisor: data.supervisor || null, // ref User
      shift: data.shift, // Morning / Evening / Night
      status: data.status || "Active",
      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

module.exports = { Guard };