const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const { prisma } = require("../config/prisma");
const env = require("../config/env");
const RbacService = require("../modules/rbac/service");

/**
 * Expose a Prisma record under both its real `id` and the legacy `_id` alias.
 *
 * Roles are read from the `userRoles` join table, which is now the only role
 * store. A handful of services were written when roles were embedded in the
 * user document and still read `_id`; rather than change every call site at
 * once, the alias is applied centrally.
 */
const withLegacyId = (record) => (record ? { ...record, _id: record.id } : record);

/**
 * Authenticate middleware — verifies the JWT access token from the Authorization
 * header (Bearer <token>) and attaches the full user object with populated
 * roles to req.user.
 *
 * Users now live in Postgres via Prisma (see prisma/schema.prisma), so this
 * must read through the same client as AuthService.login — a token issued
 * from Prisma cannot be verified against the legacy fileDB store.
 */
const authenticate = async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, "User not found or inactive");
    }

    const { passwordHash, userRoles, ...safe } = user;

    // `roles` is the single source of truth for role membership (the
    // `userRoles` join table). Role objects are exposed with both `id` and the
    // legacy `_id`, because some not-yet-migrated services still read `_id`.
    req.user = {
      ...safe,
      roles: userRoles.map((entry) => withLegacyId(entry.role)),
      _id: safe.id,
    };
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
module.exports.withLegacyId = withLegacyId;
