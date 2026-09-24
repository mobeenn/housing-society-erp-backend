const { ZodError } = require("zod");
const ApiError = require("../utils/ApiError");

/**
 * Express middleware factory that validates req.body / req.query / req.params
 * against a Zod schema.
 *
 * @param {import("zod").ZodObject} schema  Zod schema object
 * @param {"body"|"query"|"params"} source  Which part of the request to validate
 */
const validate = (schema, source = "body") => (req, _res, next) => {
  try {
    req[source] = schema.parse(req[source]);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues || error.errors || [];
      const errors = issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new ApiError(400, "Validation failed", errors);
    }
    next(error);
  }
};

module.exports = validate;
