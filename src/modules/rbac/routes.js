const express = require("express");
const { authenticate } = require("../../middlewares/auth");
const { requireSuperAdmin } = require("./middleware");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/my-access", controller.myAccess);
router.get("/roles/:roleId/access", requireSuperAdmin, controller.getRoleAccess);
router.put("/roles/:roleId/access", requireSuperAdmin, controller.updateRoleAccess);

module.exports = router;
