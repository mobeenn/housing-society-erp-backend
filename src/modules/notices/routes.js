const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const controller = require("./controller");
const { baseNoticeSchema, updateNoticeSchema } = require("./validation");

const router = express.Router();

router.use(authenticate);
router.get("/", authorize("notices", "view"), controller.list);
router.post("/", authorize("notices", "create"), validate(baseNoticeSchema), controller.create);
router.patch("/:id", authorize("notices", "create"), validate(updateNoticeSchema), controller.update);
router.post("/:id/publish", authorize("notices", "create"), controller.publish);
router.delete("/:id", authorize("notices", "delete"), controller.remove);

module.exports = router;
