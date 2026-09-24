const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const {
  createComplaintSchema,
  assignSchema,
  commentSchema,
  statusSchema,
  resolveSchema,
} = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("complaints", "view"), controller.list);
router.post("/", authorize("complaints", "create"), validate(createComplaintSchema), controller.create);
router.get("/:id", authorize("complaints", "view"), controller.get);
router.post("/:id/assign", authorize("complaints", "edit"), validate(assignSchema), controller.assign);
router.post("/:id/comments", authorize("complaints", "edit"), validate(commentSchema), controller.addComment);
router.post("/:id/status", authorize("complaints", "edit"), validate(statusSchema), controller.changeStatus);
router.post("/:id/resolve", authorize("complaints", "edit"), validate(resolveSchema), controller.resolve);
router.post("/:id/reopen", authorize("complaints", "edit"), controller.reopen);

module.exports = router;