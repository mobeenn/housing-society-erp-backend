const RoleService = require("./service");
const ApiResponse = require("../../utils/apiResponse");
const { createAuditLog } = require("../administration/auditLog.model");
const RbacService = require("../rbac/service");

class RoleController {
  async getAll(req, res) {
    const isSuperAdmin = RbacService.isSuperAdmin(req.user);
    const includeInactive =
      isSuperAdmin && String(req.query.includeInactive || "").toLowerCase() === "true";
    let roles = await RoleService.getAll({ includeInactive });
    // Hide Super Admin role from non–Super-Admin callers (P2-3).
    if (!isSuperAdmin) {
      roles = roles.filter((r) => r.name !== "Super Admin");
    }
    ApiResponse.success(res, 200, roles);
  }

  async getById(req, res) {
    const role = await RoleService.getById(req.params.id);
    ApiResponse.success(res, 200, role);
  }

  async create(req, res) {
    const role = await RoleService.create(req.body);

    // Audit log
    await createAuditLog({
      req,
      entityType: "role",
      entityId: role._id,
      action: "create",
      changes: { after: role },
    });

    ApiResponse.success(res, 201, role, "Role created successfully");
  }

  async update(req, res) {
    const before = await RoleService.getById(req.params.id);
    const role = await RoleService.update(req.params.id, req.body);

    // Audit log
    await createAuditLog({
      req,
      entityType: "role",
      entityId: role._id,
      action: "update",
      changes: { before, after: role },
    });

    ApiResponse.success(res, 200, role, "Role updated successfully");
  }

  async delete(req, res) {
    const before = await RoleService.getById(req.params.id);
    await RoleService.delete(req.params.id);

    // Audit log
    await createAuditLog({
      req,
      entityType: "role",
      entityId: req.params.id,
      action: "delete",
      changes: { before },
    });

    ApiResponse.success(res, 200, null, "Role deleted successfully");
  }
}

module.exports = new RoleController();
