const RbacService = require("./service");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiResponse = require("../../utils/apiResponse");

exports.myAccess = async (req, res) => {
  const access = await RbacService.getMyAccess(req.user);
  return ApiResponse.success(res, 200, "Current access retrieved", access);
};

exports.getRoleAccess = async (req, res) => {
  const access = await RbacService.getRoleAccessGrid(req.params.roleId);
  return ApiResponse.success(res, 200, "Role access retrieved", access);
};

exports.updateRoleAccess = async (req, res) => {
  const before = await RbacService.getRoleAccessGrid(req.params.roleId);
  const access = await RbacService.updateRoleAccess(req.params.roleId, req.body, req.user._id);
  await createAuditLog({
    req,
    entityType: "RoleModuleAccess",
    entityId: req.params.roleId,
    action: AuditLog.ACTIONS.UPDATE,
    changes: { before: before.modules, after: access.modules },
  });
  return ApiResponse.success(res, 200, "Role access updated", access);
};
