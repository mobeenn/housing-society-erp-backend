const { db } = require("../../config/db");
const { VEHICLE_TYPES, VEHICLE_STATUSES } = require("./vehicles.config");

/**
 * Vehicle Model (SRS Section 19)
 * {
 *   owner (ref Member, optional / nullable),
 *   number,
 *   type (Car, Bike, Van, Truck, SUV, Other),
 *   model,
 *   stickerNumber,
 *   status (Active, Blocked, Expired)
 * }
 */
class Vehicle {
  static collectionName = "vehicles";

  static TYPES = VEHICLE_TYPES;
  static STATUSES = VEHICLE_STATUSES;

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async findOne(query = {}) {
    return db.collection(this.collectionName).findOne(query);
  }

  static async count(query = {}) {
    return db.collection(this.collectionName).countDocuments(query);
  }

  static async create(data, createdBy) {
    return db.collection(this.collectionName).insertOne({
      owner: data.owner || null, // ref Member
      number: data.number.trim().toUpperCase(),
      type: data.type || "Car",
      model: data.model ? data.model.trim() : null,
      stickerNumber: data.stickerNumber ? data.stickerNumber.trim() : null,
      status: data.status || "Active",
      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }

  static async delete(id) {
    return db.collection(this.collectionName).deleteOne({ _id: id });
  }
}

module.exports = { Vehicle };
