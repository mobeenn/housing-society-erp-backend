const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const User = require("../modules/auth/user.model");
const env = require("../config/env");
const RbacService = require("../modules/rbac/service");

/**
 * Authenticate middleware — verifies the JWT access token from the Authorization
 * header (Bearer <token>) and attaches the full user object with populated
 * roles to req.user.
 */
const authenticate = async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    // Fetch full user with populated roles for permission checking
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      throw new ApiError(401, "User not found or inactive");
    }

    // Populate roles with permissions
    await User.populate(user, "roles");

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, "Invalid or expired token");
  }
};

/**
 * Dynamic module/action authorization.
 * Usage: authorize("members", "view")
 */
const authorize = (moduleKey, action) => {
  return async (req, _res, next) => {
    try {
      if (!req.user) throw new ApiError(401, "Authentication required");
      if (!moduleKey || !action || !(await RbacService.isAllowed(req.user, moduleKey, action))) {
        throw new ApiError(403, `Access denied for module "${moduleKey || "unknown"}" and action "${action || "unknown"}"`);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.authorize = authorize;
