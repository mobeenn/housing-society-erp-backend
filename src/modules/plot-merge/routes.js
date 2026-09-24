const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { executeMergeSchema } = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("plot-merge", "view"), controller.list);
router.get("/eligible-plots", authorize("plot-merge", "view"), controller.eligiblePlots);
router.post("/execute", authorize("plot-merge", "create"), validate(executeMergeSchema), controller.execute);
router.get("/:id/invoice.pdf", authorize("plot-merge", "view"), controller.invoice);
router.get("/:id/invoice", authorize("plot-merge", "view"), controller.invoice);
router.get("/:id", authorize("plot-merge", "view"), controller.get);

module.exports = router;
