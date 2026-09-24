const express = require("express");
const router = express.Router();

const RoleController = require("./controller");
const validate = require("../../middlewares/validate");
const { authenticate, authorize } = require("../../middlewares/auth");
const { createRoleSchema, updateRoleSchema } = require("./validation");

// All role routes require authentication
router.use(authenticate);

router.get("/", authorize("users-roles", "edit"), RoleController.getAll);
router.get("/:id", authorize("users-roles", "edit"), RoleController.getById);
router.post("/", authorize("users-roles", "edit"), validate(createRoleSchema), RoleController.create);
router.put("/:id", authorize("users-roles", "edit"), validate(updateRoleSchema), RoleController.update);
router.delete("/:id", authorize("users-roles", "edit"), RoleController.delete);

module.exports = router;
