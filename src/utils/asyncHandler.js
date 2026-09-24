/**
 * Wraps an async route handler so thrown errors are forwarded to next().
 * express-async-errors handles this globally too, but this wrapper is useful
 * when you want explicit control.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
