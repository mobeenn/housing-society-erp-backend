const { db } = require("../../config/db");

/**
 * User Model
 * Manages user documents in the file-based database
 */
class User {
  static collectionName = "users";

  /**
   * Find one user by query
   */
  static async findOne(query) {
    return await db.collection(this.collectionName).findOne(query);
  }

  /**
   * Find multiple users
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
   * Create a new user
   */
  static async create(userData) {
    const roleId = userData.roleId || (userData.roles && userData.roles[0]) || null;
    const roles = userData.roles || (roleId ? [roleId] : []);

    const result = await db.collection(this.collectionName).insertOne({
      name: userData.name?.trim(),
      email: userData.email?.toLowerCase().trim(),
      phone: userData.phone?.trim(),
      passwordHash: userData.passwordHash,
      roleId: roleId,
      roles: roles,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      lastLoginAt: userData.lastLoginAt || null,
      mustResetPassword: userData.mustResetPassword || false,
      createdBy: userData.createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
   * Update one user
   */
  static async update(id, updateData) {
    const data = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };
    return await db.collection(this.collectionName).updateOne({ _id: id }, data);
  }

  /**
   * Delete one user
   */
  static async deleteOne(query) {
    return await db.collection(this.collectionName).deleteOne(query);
  }

  /**
   * Populate role for a user document
   */
  static async populateRole(user) {
    if (!user || !user.roleId) return user;

    const Role = require("../roles/model");
    const role = await Role.findById(user.roleId);
    if (role) {
      user.role = role;
    }
    return user;
  }

  /**
   * Populate createdBy user
   */
  static async populateCreatedBy(user) {
    if (!user || !user.createdBy) return user;

    const creator = await this.findById(user.createdBy);
    if (creator) {
      user.createdBy = {
        _id: creator._id,
        name: creator.name,
        email: creator.email,
      };
    }
    return user;
  }
}

module.exports = User;
