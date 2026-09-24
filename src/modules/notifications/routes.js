const express = require("express");
const { authenticate } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const controller = require("./controller");
const { listNotificationsSchema } = require("./validation");

const router = express.Router();

router.use(authenticate);
router.get("/", validate(listNotificationsSchema), controller.list);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

module.exports = router;
