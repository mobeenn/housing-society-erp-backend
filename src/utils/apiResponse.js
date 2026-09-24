/**
 * Standard API response helpers.
 *
 * Success → { success: true,  message: "…", data: {…} }
 * Error   → { success: false, message: "…", errors: [] }
 */

class ApiResponse {
  /**
   * Send a success response.
   * Supports both (res, status, message, data) and (res, status, data, message) patterns.
   * @param {import("express").Response} res
   * @param {number}  statusCode
   * @param {*}       arg3
   * @param {*}       arg4
   */
  static success(res, statusCode = 200, arg3 = "OK", arg4 = null) {
    let message = "OK";
    let data = null;

    if (typeof arg3 === "string" && arg4 !== null && arg4 !== undefined) {
      message = arg3;
      data = arg4;
    } else if (typeof arg3 === "string" && (arg4 === null || arg4 === undefined)) {
      message = arg3;
      data = null;
    } else if (typeof arg3 !== "string") {
      data = arg3;
      if (typeof arg4 === "string") {
        message = arg4;
      }
    }

    const body = { success: true, message };
    if (data !== null && data !== undefined) body.data = data;
    return res.status(statusCode).json(body);
  }

  /**
   * Send an error response.
   * @param {import("express").Response} res
   * @param {number}  statusCode
   * @param {string}  message
   * @param {Array}   errors
   */
  static error(res, statusCode = 500, message = "Internal Server Error", errors = []) {
    return res.status(statusCode).json({ success: false, message, errors });
  }
}

module.exports = ApiResponse;
