const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { createRegistryBatchSchema, completeRegistryBatchSchema } = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/plot-options", authorize("registry", "view"), controller.plotOptions);
router.get("/batches", authorize("registry", "view"), controller.list);
router.post("/batches", authorize("registry", "create"), validate(createRegistryBatchSchema), controller.create);
router.get("/batches/:id", authorize("registry", "view"), controller.get);
router.post("/batches/:id/complete", authorize("registry", "edit"), validate(completeRegistryBatchSchema), controller.complete);

module.exports = router;
