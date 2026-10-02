const { db } = require("../../config/db");
const { prisma } = require("../../config/prisma");

/**
 * User Model
 *
 * Thin adapter used by the services that were not rewritten to Prisma yet.
 * Role membership is owned by the `user_roles` join table — the legacy inline
 * `roles` array on the user document has been removed, so `populate()` and
 * `create()` both go through Prisma here.
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
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      lastLoginAt: userData.lastLoginAt || null,
      mustResetPassword: userData.mustResetPassword || false,
      createdBy: userData.createdBy || null,
    });

    // Role assignment goes through the join table, the single source of truth.
    const roleIds = (userData.roles || []).filter((role) => typeof role === "string" && role);
    for (const roleId of roleIds) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: result.insertedId, roleId } },
        create: { userId: result.insertedId, roleId },
        update: {},
      });
    }

    result.roles = roleIds;
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
   * Populate roles for a user document.
   *
   * Reads the `user_roles` join table (the single source of truth) rather than
   * a role array embedded on the user row. Role objects are returned with both
   * `id` and the legacy `_id` so existing consumers keep working.
   */
  static async populate(user, field) {
    if (!user) return null;

    if (field === "roles") {
      const userId = user.id || user._id;
      if (!userId) return user;

      const rows = await prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });

      // A user with no join rows but a legacy single `roleId` still resolves.
      if (!rows.length && user.roleId) {
        const single = await prisma.role.findUnique({ where: { id: user.roleId } });
        if (single) {
          user.roles = [{ ...single, _id: single.id }];
          user.role = user.roles[0];
          return user;
        }
      }

      user.roles = rows.map((row) => ({ ...row.role, _id: row.role.id }));
      if (!user.role && user.roles[0]) {
        user.role = user.roles[0];
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
