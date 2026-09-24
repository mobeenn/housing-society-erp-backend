const ApiError = require("../utils/ApiError");

/**
 * Catch-all for undefined routes.
 */
const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

module.exports = notFound;
