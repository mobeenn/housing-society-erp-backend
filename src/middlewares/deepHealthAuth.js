const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const { prisma } = require("../config/prisma");
const RbacService = require("../modules/rbac/service");

const withLegacyId = (record) => (record ? { ...record, _id: record.id } : record);

function tokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Allow deep health when:
 * - Header `x-health-check-token` matches HEALTH_CHECK_TOKEN, or
 * - Bearer access JWT belongs to an active Super Admin.
 */
const deepHealthAuth = async (req, _res, next) => {
  try {
    const headerToken = req.get("x-health-check-token");
    if (env.HEALTH_CHECK_TOKEN && tokensMatch(headerToken, env.HEALTH_CHECK_TOKEN)) {
      return next();
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication required");
    }

    const token = header.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch {
      throw new ApiError(401, "Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, "User not found or inactive");
    }

    const { passwordHash, userRoles, ...safe } = user;
    req.user = {
      ...safe,
      roles: userRoles.map((entry) => withLegacyId(entry.role)),
      _id: safe.id,
    };

    if (!RbacService.isSuperAdmin(req.user)) {
      throw new ApiError(403, "Super Admin access required");
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = deepHealthAuth;
