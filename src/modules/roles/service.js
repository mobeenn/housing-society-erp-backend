const { prisma } = require("../../config/prisma");
const ApiError = require("../../utils/ApiError");
const RbacService = require("../rbac/service");

class RoleService {
  async getAll() {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "desc" },
    });
    return roles.map((r) => ({
      ...r,
      isSystem: !!(r.isSystem || r.isSystemRole),
    }));
  }

  async getById(id) {
    const role = await prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new ApiError(404, "Role not found");
    }
    return {
      ...role,
      isSystem: !!(role.isSystem || role.isSystemRole),
    };
  }

  async create(roleData) {
    // Check if role name already exists
    const existing = await prisma.role.findUnique({
      where: { name: roleData.name },
    });
    if (existing) {
      throw new ApiError(400, "Role with this name already exists");
    }

    const role = await prisma.role.create({
      data: {
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions || [],
        isSystemRole: roleData.isSystemRole || false,
      },
    });

    // Migrate role access for dynamic RBAC
    await RbacService.migrateRoleAccess(role.id);

    return role;
  }

  async update(id, updateData) {
    const role = await prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new ApiError(404, "Role not found");
    }

    // System roles cannot be modified
    if (role.isSystem || role.isSystemRole) {
      throw new ApiError(403, "System roles cannot be modified");
    }

    // Check if new name conflicts with another role
    if (updateData.name && updateData.name !== role.name) {
      const existing = await prisma.role.findUnique({
        where: { name: updateData.name },
      });
      if (existing) {
        throw new ApiError(400, "Role with this name already exists");
      }
    }

    const updated = await prisma.role.update({
      where: { id },
      data: updateData,
    });

    // Keep legacy role edits safe during the transition: if a caller updates
    // the legacy permission list, regenerate its dynamic matrix as well.
    if (Array.isArray(updateData.permissions)) {
      await RbacService.migrateRoleAccess(id);
    }

    return updated;
  }

  async delete(id) {
    const role = await prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new ApiError(404, "Role not found");
    }

    // System roles cannot be deleted
    if (role.isSystem || role.isSystemRole) {
      throw new ApiError(403, "System roles cannot be deleted");
    }

    // Check if any users are assigned to this role
    const usersWithRole = await prisma.userRole.findMany({
      where: { roleId: id },
      include: { user: true },
    });
    if (usersWithRole.length > 0) {
      throw new ApiError(
        400,
        `Cannot delete role. ${usersWithRole.length} user(s) are currently assigned to this role.`
      );
    }

    // Clean up RoleModuleAccess records
    await prisma.roleModuleAccess.deleteMany({
      where: { roleId: id },
    });

    return await prisma.role.delete({
      where: { id },
    });
  }
}

module.exports = new RoleService();
