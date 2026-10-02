const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/apiResponse");
const env = require("../config/env");

/**
 * Global error-handling middleware.
 * Must have four parameters so Express recognises it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Default to 500 if nothing was set
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || [];

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue).join(", ");
    message = `Duplicate value for field(s): ${field}`;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errors = Object.values(err.errors).map((e) => e.message);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Log in development.
  // Only unexpected errors get a stack trace. A 404 for an unknown route is
  // routine client traffic (typos, /favicon.ico, scanners) and printing a full
  // stack for it buries real failures in noise.
  if (env.isDev && statusCode >= 500) {
    console.error("❌ Error:", err);
  } else if (env.isDev && statusCode !== 404) {
    console.warn(`⚠️  ${req.method} ${req.originalUrl} → ${statusCode}: ${message}`);
  }

  return ApiResponse.error(res, statusCode, message, errors);
};

module.exports = errorHandler;
