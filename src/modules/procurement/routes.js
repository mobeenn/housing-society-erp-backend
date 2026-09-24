const express = require("express");
const router = express.Router();
const controller = require("./controller");
const {
  createVendorSchema,
  updateVendorSchema,
  createPurchaseRequestSchema,
  updatePurchaseRequestSchema,
  createQuotationSchema,
  updateQuotationSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  createGRNSchema,
  updateGRNSchema,
} = require("./validation");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");

// All procurement routes require authentication
router.use(authenticate);

// ========== Vendor Routes ==========
router.get(
  "/vendors",
  authorize("procurement", "view"),
  controller.listVendors
);

router.get(
  "/vendors/:id",
  authorize("procurement", "view"),
  controller.getVendor
);

router.post(
  "/vendors",
  authorize("procurement", "create"),
  validate(createVendorSchema),
  controller.createVendor
);

router.put(
  "/vendors/:id",
  authorize("procurement", "edit"),
  validate(updateVendorSchema),
  controller.updateVendor
);

router.delete(
  "/vendors/:id",
  authorize("procurement", "approve"),
  controller.deleteVendor
);

router.get(
  "/vendors/:id/purchase-history",
  authorize("procurement", "view"),
  controller.getVendorPurchaseHistory
);

// ========== Purchase Request Routes ==========
router.get(
  "/purchase-requests",
  authorize("procurement", "view"),
  controller.listPurchaseRequests
);

router.get(
  "/purchase-requests/:id",
  authorize("procurement", "view"),
  controller.getPurchaseRequest
);

router.post(
  "/purchase-requests",
  authorize("procurement", "create"),
  validate(createPurchaseRequestSchema),
  controller.createPurchaseRequest
);

router.put(
  "/purchase-requests/:id",
  authorize("procurement", "edit"),
  validate(updatePurchaseRequestSchema),
  controller.updatePurchaseRequest
);

router.delete(
  "/purchase-requests/:id",
  authorize("procurement", "approve"),
  controller.deletePurchaseRequest
);

// ========== Quotation Routes ==========
router.get(
  "/quotations",
  authorize("procurement", "view"),
  controller.listQuotations
);

router.get(
  "/quotations/:id",
  authorize("procurement", "view"),
  controller.getQuotation
);

router.post(
  "/quotations",
  authorize("procurement", "create"),
  validate(createQuotationSchema),
  controller.createQuotation
);

router.put(
  "/quotations/:id",
  authorize("procurement", "edit"),
  validate(updateQuotationSchema),
  controller.updateQuotation
);

router.delete(
  "/quotations/:id",
  authorize("procurement", "approve"),
  controller.deleteQuotation
);

// ========== Purchase Order Routes ==========
router.get(
  "/purchase-orders",
  authorize("procurement", "view"),
  controller.listPurchaseOrders
);

router.get(
  "/purchase-orders/:id",
  authorize("procurement", "view"),
  controller.getPurchaseOrder
);

router.post(
  "/purchase-orders",
  authorize("procurement", "approve"),
  validate(createPurchaseOrderSchema),
  controller.createPurchaseOrder
);

router.put(
  "/purchase-orders/:id",
  authorize("procurement", "edit"),
  validate(updatePurchaseOrderSchema),
  controller.updatePurchaseOrder
);

router.delete(
  "/purchase-orders/:id",
  authorize("procurement", "approve"),
  controller.deletePurchaseOrder
);

// ========== GRN Routes ==========
router.get(
  "/grns",
  authorize("procurement", "view"),
  controller.listGRNs
);

router.get(
  "/grns/:id",
  authorize("procurement", "view"),
  controller.getGRN
);

router.post(
  "/grns",
  authorize("procurement", "create"),
  validate(createGRNSchema),
  controller.createGRN
);

router.put(
  "/grns/:id",
  authorize("procurement", "edit"),
  validate(updateGRNSchema),
  controller.updateGRN
);

router.delete(
  "/grns/:id",
  authorize("procurement", "approve"),
  controller.deleteGRN
);

module.exports = router;
