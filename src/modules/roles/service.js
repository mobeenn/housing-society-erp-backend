const Role = require("./model");
const User = require("../users/model");
const ApiError = require("../../utils/ApiError");
const RbacService = require("../rbac/service");
const { RoleModuleAccess } = require("../rbac/access.model");

class RoleService {
  async getAll() {
    const roles = await Role.find({}, { sort: { createdAt: -1 } });
    return roles.map((r) => ({
      ...r,
      isSystem: !!(r.isSystem || r.isSystemRole),
    }));
  }

  async getById(id) {
    const role = await Role.findById(id);
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
    const existing = await Role.findByName(roleData.name);
    if (existing) {
      throw new ApiError(400, "Role with this name already exists");
    }

    const role = await Role.create(roleData);
    await RbacService.migrateRoleAccess(role._id);
    return role;
  }

  async update(id, updateData) {
    const role = await Role.findById(id);
    if (!role) {
      throw new ApiError(404, "Role not found");
    }

    // System roles cannot be modified
    if (role.isSystem || role.isSystemRole) {
      throw new ApiError(403, "System roles cannot be modified");
    }

    // Check if new name conflicts with another role
    if (updateData.name && updateData.name !== role.name) {
      const existing = await Role.findByName(updateData.name);
      if (existing) {
        throw new ApiError(400, "Role with this name already exists");
      }
    }

    const updated = await Role.update(id, updateData);
    // Keep legacy role edits safe during the transition: if a caller updates
    // the legacy permission list, regenerate its dynamic matrix as well.
    if (Array.isArray(updateData.permissions)) {
      await RbacService.migrateRoleAccess(id);
    }
    return updated;
  }

  async delete(id) {
    const role = await Role.findById(id);
    if (!role) {
      throw new ApiError(404, "Role not found");
    }

    // System roles cannot be deleted
    if (role.isSystem || role.isSystemRole) {
      throw new ApiError(403, "System roles cannot be deleted");
    }

    // Check if any users are assigned to this role
    const allUsers = await User.find({});
    const users = allUsers.filter((user) => user.roleId === id || (Array.isArray(user.roles) && user.roles.includes(id)));
    if (users.length > 0) {
      throw new ApiError(
        400,
        `Cannot delete role. ${users.length} user(s) are currently assigned to this role.`
      );
    }

    const accessRecords = await RoleModuleAccess.find({ role: id });
    for (const record of accessRecords) {
      await RoleModuleAccess.deleteOne({ _id: record._id });
    }
    return await Role.delete(id);
  }
}

module.exports = new RoleService();
