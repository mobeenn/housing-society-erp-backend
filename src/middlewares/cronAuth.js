const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

function tokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Vercel Cron / external schedulers send Authorization: Bearer <CRON_SECRET>.
 */
const cronAuth = (req, _res, next) => {
  try {
    if (!env.CRON_SECRET) {
      throw new ApiError(503, "CRON_SECRET is not configured");
    }
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!tokensMatch(token, env.CRON_SECRET)) {
      throw new ApiError(401, "Invalid cron secret");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = cronAuth;
