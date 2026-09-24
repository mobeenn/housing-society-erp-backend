const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "passes";

class Pass {
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
    const pass = {
      _id: uuidv4(),
      passNumber: data.passNumber,
      type: data.type || "Visitor",
      holderName: data.holderName,
      phone: data.phone || null,
      cnic: data.cnic || null,
      validFrom: data.validFrom,
      validTo: data.validTo,
      relatedMember: data.relatedMember || null,
      status: data.status || "Active",
      purpose: data.purpose || null,
      notes: data.notes || null,
      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(pass);
    return { ...pass, _id: result.insertedId || pass._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }
}

module.exports = { Pass };
