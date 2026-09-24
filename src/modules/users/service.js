const bcrypt = require("bcryptjs");
const User = require("./model");
const Role = require("../roles/model");
const ApiError = require("../../utils/ApiError");
const { createAuditLog } = require("../administration/auditLog.model");

class UserService {
  /**
   * Get all users with pagination, search, and sorting.
   */
  static async getAll(queryParams = {}) {
    const {
      page = 1,
      limit = 20,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      isActive,
      roleId,
    } = queryParams;

    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    // Search by name or email
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
      ];
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === "true" || isActive === true;
    }

    // Filter by role
    if (roleId) {
      query.roleId = roleId;
    }

    // Build sort option
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Fetch users with pagination
    const users = await User.find(query, { sort, skip, limit });

    // Populate role for each user
    for (const user of users) {
      await User.populateRole(user);
      delete user.passwordHash; // Never return password hash
    }

    const total = await User.countDocuments(query);

    return {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID.
   */
  static async getById(id) {
    const user = await User.findById(id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    await User.populateRole(user);
    await User.populateCreatedBy(user);
    delete user.passwordHash;

    return user;
  }

  /**
   * Create a new user.
   */
  static async create(userData, createdByUserId, req) {
    const { name, email, phone, password, roleId, mustResetPassword } = userData;

    // Check if email already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new ApiError(409, "Email already in use");
    }

    // Validate role exists
    const role = await Role.findById(roleId);
    if (!role) {
      throw new ApiError(400, "Invalid role");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      roleId,
      mustResetPassword: mustResetPassword || false,
      createdBy: createdByUserId,
    });

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: user._id,
      action: "create",
      changes: { after: { name, email, roleId, isActive: user.isActive } },
    });

    return this.getById(user._id);
  }

  /**
   * Update user by ID.
   */
  static async update(id, updateData, req) {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const dataToUpdate = { ...updateData };

    // Validate role if provided
    if (updateData.roleId) {
      const role = await Role.findById(updateData.roleId);
      if (!role) {
        throw new ApiError(400, "Invalid role");
      }
      dataToUpdate.roles = [updateData.roleId];
    }

    const before = await this.getById(id);
    await User.update(id, dataToUpdate);

    const after = await this.getById(id);

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: id,
      action: "update",
      changes: { before, after },
    });

    return after;
  }

  /**
   * Soft delete user by setting isActive to false.
   */
  static async deactivate(id, req) {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const before = await this.getById(id);
    await User.update(id, { isActive: false });

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: id,
      action: "deactivate",
      changes: { before, after: { ...before, isActive: false } },
    });

    return this.getById(id);
  }

  /**
   * Toggle user active status.
   */
  static async toggleActive(id, req) {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const before = await this.getById(id);
    await User.update(id, { isActive: !user.isActive });

    const after = await this.getById(id);

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: id,
      action: user.isActive ? "deactivate" : "activate",
      changes: { before, after },
    });

    return after;
  }

  /**
   * Trigger password reset (sets mustResetPassword flag).
   */
  static async triggerPasswordReset(id, req) {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    await User.update(id, { mustResetPassword: true });

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: id,
      action: "trigger_password_reset",
      changes: { after: { mustResetPassword: true } },
    });

    return { message: "Password reset triggered. User must reset password on next login." };
  }
}

module.exports = UserService;
