const { z } = require("zod");
const Vendor = require("./vendor.model");
const PurchaseRequest = require("./purchaseRequest.model");
const Quotation = require("./quotation.model");
const PurchaseOrder = require("./purchaseOrder.model");
const GRN = require("./grn.model");

// Document schema helper
const documentSchema = z.object({
  name: z.string(),
  url: z.string(),
  uploadedAt: z.string().optional(),
});

// ========== Vendor Schemas ==========
const createVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  category: z.string().min(1, "Category is required"),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  ntn: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  status: z.enum(Object.values(Vendor.STATUSES)).optional(),
  performanceNotes: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
});

const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  ntn: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  status: z.enum(Object.values(Vendor.STATUSES)).optional(),
  performanceNotes: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
});

// ========== Purchase Request Schemas ==========
const createPurchaseRequestSchema = z.object({
  itemDescription: z.string().min(1, "Item description is required"),
  quantity: z.number().int().min(1).default(1),
  estimatedCost: z.number().min(0).optional().nullable(),
  justification: z.string().min(1, "Justification is required"),
  requiredDate: z.string().optional().nullable(),
  priority: z.enum(Object.values(PurchaseRequest.PRIORITIES)).optional(),
  department: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
});

const updatePurchaseRequestSchema = z.object({
  itemDescription: z.string().min(1).optional(),
  quantity: z.number().int().min(1).optional(),
  estimatedCost: z.number().min(0).optional().nullable(),
  justification: z.string().min(1).optional(),
  requiredDate: z.string().optional().nullable(),
  priority: z.enum(Object.values(PurchaseRequest.PRIORITIES)).optional(),
  status: z.enum(Object.values(PurchaseRequest.STATUSES)).optional(),
  rejectionReason: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
});

// ========== Quotation Schemas ==========
const quotationItemSchema = z.object({
  item: z.string(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  totalPrice: z.number().min(0),
  description: z.string().optional().nullable(),
});

const createQuotationSchema = z.object({
  purchaseRequest: z.string().min(1, "Purchase request reference is required"),
  vendor: z.string().min(1, "Vendor reference is required"),
  amount: z.number().min(0, "Amount must be positive"),
  validUntil: z.string().min(1, "Valid until date is required"),
  items: z.array(quotationItemSchema).optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  warrantyTerms: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
  remarks: z.string().optional().nullable(),
});

const updateQuotationSchema = z.object({
  amount: z.number().min(0).optional(),
  validUntil: z.string().optional(),
  items: z.array(quotationItemSchema).optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  warrantyTerms: z.string().optional().nullable(),
  status: z.enum(Object.values(Quotation.STATUSES)).optional(),
  documents: z.array(documentSchema).optional(),
  remarks: z.string().optional().nullable(),
});

// ========== Purchase Order Schemas ==========
const poItemSchema = z.object({
  item: z.string().min(1, "Item name is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  totalPrice: z.number().min(0, "Total price must be non-negative"),
  description: z.string().optional().nullable(),
});

const createPurchaseOrderSchema = z.object({
  purchaseRequest: z.string().min(1, "Purchase request reference is required"),
  selectedVendor: z.string().min(1, "Vendor reference is required"),
  selectedQuotation: z.string().optional().nullable(),
  items: z.array(poItemSchema).min(1, "At least one item is required"),
  totalAmount: z.number().min(0, "Total amount must be non-negative"),
  currency: z.string().optional(),
  paymentTerms: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
  remarks: z.string().optional().nullable(),
});

const updatePurchaseOrderSchema = z.object({
  items: z.array(poItemSchema).optional(),
  totalAmount: z.number().min(0).optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  status: z.enum(Object.values(PurchaseOrder.STATUSES)).optional(),
  cancellationReason: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
  remarks: z.string().optional().nullable(),
});

// ========== GRN Schemas ==========
const grnItemSchema = z.object({
  item: z.string().min(1, "Item name is required"),
  orderedQty: z.number().int().min(0, "Ordered qty must be non-negative"),
  receivedQty: z.number().int().min(0, "Received qty must be non-negative"),
  rejectedQty: z.number().int().min(0).optional().default(0),
  qualityCheckNote: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const createGRNSchema = z.object({
  purchaseOrder: z.string().min(1, "Purchase order reference is required"),
  items: z.array(grnItemSchema).min(1, "At least one item is required"),
  date: z.string().optional().nullable(),
  deliveryChallanNo: z.string().optional().nullable(),
  inspectionStatus: z.enum(Object.values(GRN.INSPECTION_STATUSES)).optional(),
  remarks: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
});

const updateGRNSchema = z.object({
  items: z.array(grnItemSchema).optional(),
  date: z.string().optional().nullable(),
  deliveryChallanNo: z.string().optional().nullable(),
  inspectionStatus: z.enum(Object.values(GRN.INSPECTION_STATUSES)).optional(),
  remarks: z.string().optional().nullable(),
  documents: z.array(documentSchema).optional(),
});

module.exports = {
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
};
