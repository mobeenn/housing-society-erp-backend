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
    const result = await db.collection(this.collectionName).insertOne({
      name: userData.name?.trim(),
      email: userData.email?.toLowerCase().trim(),
      phone: userData.phone?.trim(),
      memberId: userData.memberId || null,
      passwordHash: userData.passwordHash,
      roles: userData.roles || [],
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      lastLoginAt: userData.lastLoginAt || null,
      mustResetPassword: userData.mustResetPassword || false,
      createdBy: userData.createdBy || null,
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
  static async updateOne(query, update) {
    return await db.collection(this.collectionName).updateOne(query, update);
  }

  /**
   * Delete one user
   */
  static async deleteOne(query) {
    return await db.collection(this.collectionName).deleteOne(query);
  }

  /**
   * Populate roles for a user document
   */
  static async populate(user, field) {
    if (!user) return null;

    if (field === "roles") {
      const Role = require("./role.model");
      if (user.roles && user.roles.length > 0) {
        user.roles = await Promise.all(
          user.roles.map(async (roleId) => {
            if (typeof roleId === "object" && roleId !== null && roleId.permissions) {
              return roleId;
            }
            const role = await Role.findById(roleId);
            return role || roleId;
          })
        );
        if (!user.role && user.roles[0]) {
          user.role = user.roles[0];
        }
      } else if (user.roleId) {
        const role = await Role.findById(user.roleId);
        if (role) {
          user.roles = [role];
          user.role = role;
        }
      }
    }

    if (field === "createdBy" && user.createdBy) {
      const creator = await this.findById(user.createdBy);
      if (creator) {
        user.createdBy = {
          _id: creator._id,
          name: creator.name,
          email: creator.email,
        };
      }
    }

    return user;
  }

  /**
   * Check if user has a specific permission
   */
  static hasPermission(user, permission) {
    if (!user) return false;
    const checkRole = (role) => {
      if (!role || typeof role !== "object") return false;
      if (role.permissions?.includes("system:admin")) return true;
      return role.permissions?.includes(permission);
    };

    if (user.roles && user.roles.length > 0 && user.roles.some(checkRole)) {
      return true;
    }
    if (user.role && checkRole(user.role)) {
      return true;
    }
    return false;
  }
}

module.exports = User;
