const express = require("express");
const { authenticate } = require("../../middlewares/auth");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/pending", controller.getPending);

module.exports = router;
