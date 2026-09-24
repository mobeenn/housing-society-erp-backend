const { db } = require("../../config/db");
const { ASSET_TYPES } = require("./maintenance.config");

/**
 * Asset Model (SRS Section 17)
 * { name, type (road/light/park/water/sewerage/drainage/building/other),
 *   location, block (ref Block, nullable) }
 */
class Asset {
  static collectionName = "assets";

  static TYPES = ASSET_TYPES;

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
      name: data.name.trim(),
      type: data.type,
      location: data.location?.trim() || null,
      block: data.block || null, // nullable — master data Block reference
      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

module.exports = { Asset };