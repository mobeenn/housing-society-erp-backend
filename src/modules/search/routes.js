const express = require("express");
const { authenticate } = require("../../middlewares/auth");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/", controller.search);

module.exports = router;
