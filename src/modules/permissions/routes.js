const express = require("express");
const { authenticate } = require("../../middlewares/auth");
const RbacService = require("../rbac/service");
const ApiResponse = require("../../utils/apiResponse");

const router = express.Router();
router.use(authenticate);

/**
 * Dynamic module/action catalog. The legacy permission endpoint remains at
 * this path for API compatibility, but its data now comes from the RBAC
 * registry rather than the static permission list.
 */
router.get("/catalog", async (_req, res) => {
  const catalog = await RbacService.catalog();
  return ApiResponse.success(res, 200, catalog);
});

module.exports = router;
