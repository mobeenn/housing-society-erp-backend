const express = require("express");
const router = express.Router();

const UserController = require("./controller");
const validate = require("../../middlewares/validate");
const { authenticate, authorize } = require("../../middlewares/auth");
const { createUserSchema, updateUserSchema } = require("./validation");

// All user routes require authentication
router.use(authenticate);

router.get("/", authorize("users-roles", "edit"), UserController.getAll);
router.get("/:id", authorize("users-roles", "edit"), UserController.getById);
router.post(
  "/",
  authorize("users-roles", "edit"),
  validate(createUserSchema),
  UserController.create
);
router.patch(
  "/:id",
  authorize("users-roles", "edit"),
  validate(updateUserSchema),
  UserController.update
);
router.patch("/:id/toggle-active", authorize("users-roles", "edit"), UserController.toggleActive);
router.patch("/:id/deactivate", authorize("users-roles", "edit"), UserController.deactivate);
router.post("/:id/reset-password", authorize("users-roles", "edit"), UserController.triggerPasswordReset);

module.exports = router;
