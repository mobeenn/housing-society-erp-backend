const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "blacklist";

class BlacklistEntry {
  static get collectionName() {
    return collectionName;
  }

  static async find(query = {}, options = {}) {
    return db.collection(collectionName).find(query, options);
  }

  static async findOne(query) {
    return db.collection(collectionName).findOne(query);
  }

  static async findById(id) {
    return db.collection(collectionName).findOne({ _id: id });
  }

  static async create(data, addedBy) {
    const entry = {
      _id: uuidv4(),
      name: data.name ? data.name.trim() : null,
      cnic: data.cnic ? data.cnic.trim() : null,
      phone: data.phone ? data.phone.trim() : null,
      vehicleNumber: data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : null,
      reason: data.reason,
      action: data.action || "Warn", // "Warn" or "Block"
      status: data.status || "Active",
      addedBy: addedBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(entry);
    return { ...entry, _id: result.insertedId || entry._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }
}

module.exports = { BlacklistEntry };
