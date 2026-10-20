const express = require("express");
const { authenticate } = require("../../middlewares/auth");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);
router.get("/members", controller.searchMembers);
router.get("/plots", controller.searchPlots);

module.exports = router;
