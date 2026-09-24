const RbacService = require("./service");
const ApiError = require("../../utils/ApiError");

const requireSuperAdmin = (req, _res, next) => {
  if (!req.user || !RbacService.isSuperAdmin(req.user)) {
    throw new ApiError(403, "Super Admin access required");
  }
  next();
};

module.exports = { requireSuperAdmin };
