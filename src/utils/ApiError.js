/**
 * Custom API error class.
 * Throw this anywhere — the global error handler will catch it and format
 * the response using the standard error envelope.
 */
class ApiError extends Error {
  /**
   * @param {number}   statusCode  HTTP status code
   * @param {string}   message     Human-readable message
   * @param {Array}    errors      Optional array of validation / field errors
   * @param {string}   stack       Optional pre-built stack trace
   */
  constructor(statusCode, message, errors = [], stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
