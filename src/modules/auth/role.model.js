const { db } = require("../../config/db");

/**
 * Role Model
 * Manages role documents in the file-based database
 */
class Role {
  static collectionName = "roles";

  /**
   * Find one role by query
   */
  static async findOne(query) {
    return await db.collection(this.collectionName).findOne(query);
  }

  /**
   * Find multiple roles
   */
  static async find(query = {}, options = {}) {
    return await db.collection(this.collectionName).find(query, options);
  }

  /**
   * Count documents
   */
  static async countDocuments(query = {}) {
    return await db.collection(this.collectionName).countDocuments(query);
  }

  /**
   * Create a new role
   */
  static async create(roleData) {
    const result = await db.collection(this.collectionName).insertOne({
      name: roleData.name?.trim(),
      description: roleData.description?.trim(),
      permissions: roleData.permissions || [],
      isSystemRole: roleData.isSystemRole || false,
    });
    return result;
  }

  /**
   * Find by ID
   */
  static async findById(id) {
    return await db.collection(this.collectionName).findOne({ _id: id });
  }

  /**
   * Update one role
   */
  static async updateOne(query, update) {
    return await db.collection(this.collectionName).updateOne(query, update);
  }

  /**
   * Delete one role
   */
  static async deleteOne(query) {
    return await db.collection(this.collectionName).deleteOne(query);
  }
}

module.exports = Role;
