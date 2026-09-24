const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "visitorEntries";

class VisitorEntry {
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

  static async create(data, createdBy) {
    const entry = {
      _id: uuidv4(),
      visitorName: data.visitorName,
      phone: data.phone || null,
      cnic: data.cnic || null,
      hostMember: data.hostMember || null,
      purpose: data.purpose || "General Visit",
      gate: data.gate || "Main Gate",
      vehicleNumber: data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : null,
      entryTime: data.entryTime || new Date().toISOString(),
      exitTime: null, // active until set
      exitMarkedBy: null,
      remarks: data.remarks || null,
      passId: data.passId || null,
      createdBy: createdBy || null,
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

module.exports = { VisitorEntry };
