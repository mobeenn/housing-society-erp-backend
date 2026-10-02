const bcrypt = require("bcryptjs");
const { prisma } = require("../../config/prisma");
const ApiError = require("../../utils/ApiError");
const { createAuditLog } = require("../administration/auditLog.model");
const { USER_SORT_FIELDS } = require("./validation");

class UserService {
  /**
   * Get all users with pagination, search, and sorting.
   */
  static async getAll(queryParams = {}) {
    const {
      search = "",
      isActive,
      roleId,
    } = queryParams;

    // Query params reach this service as strings. Prisma requires real integers
    // for skip/take, so normalise here as well as in the route validator —
    // this method must not depend on a middleware having run first.
    const page = Number.parseInt(queryParams.page, 10) || 1;
    const limit = Math.min(Math.max(Number.parseInt(queryParams.limit, 10) || 20, 1), 100);
    const sortBy = USER_SORT_FIELDS.includes(queryParams.sortBy) ? queryParams.sortBy : "createdAt";
    const sortOrder = queryParams.sortOrder === "asc" ? "asc" : "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive === "true" || isActive === true;
    }

    // Filter by role
    if (roleId) {
      where.userRoles = { some: { roleId } };
    }

    // Build orderBy
    const orderBy = {};
    orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";

    // Fetch users with pagination
    const users = await prisma.user.findMany({
      where,
      include: {
        userRoles: { include: { role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy,
      skip,
      take: limit,
    });

    const total = await prisma.user.count({ where });

    // Remove passwordHash from each user
    const sanitizedUsers = users.map((user) => {
      const { passwordHash, ...rest } = user;
      return rest;
    });

    return {
      users: sanitizedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID.
   */
  static async getById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Remove passwordHash
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Create a new user.
   */
  static async create(userData, createdByUserId, req) {
    const { name, email, phone, password, roleId, mustResetPassword } = userData;

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      throw new ApiError(409, "Email already in use");
    }

    // Validate role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      throw new ApiError(400, "Invalid role");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        passwordHash,
        mustResetPassword: mustResetPassword || false,
        createdById: createdByUserId,
        userRoles: {
          create: { roleId },
        },
      },
      include: {
        userRoles: { include: { role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: user.id,
      action: "create",
      changes: { after: { name, email, roleId, isActive: user.isActive } },
    });

    // Remove passwordHash
    const { passwordHash: _, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Update user by ID.
   */
  static async update(id, updateData, req) {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const dataToUpdate = { ...updateData };

    // Validate role if provided
    if (updateData.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: updateData.roleId },
      });
      if (!role) {
        throw new ApiError(400, "Invalid role");
      }
    }

    const before = await this.getById(id);

    // Handle role update separately
    if (updateData.roleId) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      await prisma.userRole.create({
        data: { userId: id, roleId: updateData.roleId },
      });
      delete dataToUpdate.roleId;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      include: {
        userRoles: { include: { role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    const after = await this.getById(id);

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: id,
      action: "update",
      changes: { before, after },
    });

    // Remove passwordHash
    const { passwordHash, ...sanitizedUser } = updatedUser;
    return sanitizedUser;
  }

  /**
   * Soft delete user by setting isActive to false.
   */
  static async deactivate(id, req) {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const before = await this.getById(id);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: {
        userRoles: { include: { role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: id,
      action: "deactivate",
      changes: { before, after: { ...before, isActive: false } },
    });

    // Remove passwordHash
    const { passwordHash, ...sanitizedUser } = updatedUser;
    return sanitizedUser;
  }

  /**
   * Toggle user active status.
   */
  static async toggleActive(id, req) {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const before = await this.getById(id);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      include: {
        userRoles: { include: { role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    const after = await this.getById(id);

    // Audit log
    await createAuditLog({
      req,
      entityType: "user",
      entityId: id,
      action: user.isActive ? "deactivate" : "activate",
      changes: { before, after },
    });

    // Remove passwordHash
    const { passwordHash, ...sanitizedUser } = updatedUser;
    return sanitizedUser;
  }

  /**
   * Trigger password reset (sets mustResetPassword flag).
   */
  static async triggerPasswordReset(id, req) {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    await prisma.user.update({
      where: { id },
      data: { mustResetPassword: true },
    });

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
