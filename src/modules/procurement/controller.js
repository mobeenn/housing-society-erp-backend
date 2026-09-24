const {
  VendorService,
  PurchaseRequestService,
  QuotationService,
  PurchaseOrderService,
  GRNService,
} = require("./service");
const ApiResponse = require("../../utils/apiResponse");

// ========== Vendor Controllers ==========
const listVendors = async (req, res) => {
  const result = await VendorService.list(req.query);
  ApiResponse.success(res, 200, "Vendors retrieved successfully", result);
};

const getVendor = async (req, res) => {
  const vendor = await VendorService.get(req.params.id);
  ApiResponse.success(res, 200, "Vendor retrieved successfully", vendor);
};

const createVendor = async (req, res) => {
  const vendor = await VendorService.create(req.body, req);
  ApiResponse.success(res, 201, "Vendor created successfully", vendor);
};

const updateVendor = async (req, res) => {
  const vendor = await VendorService.update(req.params.id, req.body, req);
  ApiResponse.success(res, 200, "Vendor updated successfully", vendor);
};

const deleteVendor = async (req, res) => {
  const result = await VendorService.delete(req.params.id, req);
  ApiResponse.success(res, 200, result.message);
};

const getVendorPurchaseHistory = async (req, res) => {
  const history = await VendorService.getPurchaseHistory(req.params.id);
  ApiResponse.success(res, 200, "Vendor purchase history retrieved successfully", history);
};

// ========== Purchase Request Controllers ==========
const listPurchaseRequests = async (req, res) => {
  const result = await PurchaseRequestService.list(req.query);
  ApiResponse.success(res, 200, "Purchase requests retrieved successfully", result);
};

const getPurchaseRequest = async (req, res) => {
  const pr = await PurchaseRequestService.get(req.params.id);
  ApiResponse.success(res, 200, "Purchase request retrieved successfully", pr);
};

const createPurchaseRequest = async (req, res) => {
  const pr = await PurchaseRequestService.create(req.body, req);
  ApiResponse.success(res, 201, "Purchase request created successfully", pr);
};

const updatePurchaseRequest = async (req, res) => {
  const pr = await PurchaseRequestService.update(req.params.id, req.body, req);
  ApiResponse.success(res, 200, "Purchase request updated successfully", pr);
};

const deletePurchaseRequest = async (req, res) => {
  const result = await PurchaseRequestService.delete(req.params.id, req);
  ApiResponse.success(res, 200, result.message);
};

// ========== Quotation Controllers ==========
const listQuotations = async (req, res) => {
  const result = await QuotationService.list(req.query);
  ApiResponse.success(res, 200, "Quotations retrieved successfully", result);
};

const getQuotation = async (req, res) => {
  const quotation = await QuotationService.get(req.params.id);
  ApiResponse.success(res, 200, "Quotation retrieved successfully", quotation);
};

const createQuotation = async (req, res) => {
  const quotation = await QuotationService.create(req.body, req);
  ApiResponse.success(res, 201, "Quotation created successfully", quotation);
};

const updateQuotation = async (req, res) => {
  const quotation = await QuotationService.update(req.params.id, req.body, req);
  ApiResponse.success(res, 200, "Quotation updated successfully", quotation);
};

const deleteQuotation = async (req, res) => {
  const result = await QuotationService.delete(req.params.id, req);
  ApiResponse.success(res, 200, result.message);
};

// ========== Purchase Order Controllers ==========
const listPurchaseOrders = async (req, res) => {
  const result = await PurchaseOrderService.list(req.query);
  ApiResponse.success(res, 200, "Purchase orders retrieved successfully", result);
};

const getPurchaseOrder = async (req, res) => {
  const po = await PurchaseOrderService.get(req.params.id);
  ApiResponse.success(res, 200, "Purchase order retrieved successfully", po);
};

const createPurchaseOrder = async (req, res) => {
  const po = await PurchaseOrderService.create(req.body, req);
  ApiResponse.success(res, 201, "Purchase order created successfully", po);
};

const updatePurchaseOrder = async (req, res) => {
  const po = await PurchaseOrderService.update(req.params.id, req.body, req);
  ApiResponse.success(res, 200, "Purchase order updated successfully", po);
};

const deletePurchaseOrder = async (req, res) => {
  const result = await PurchaseOrderService.delete(req.params.id, req);
  ApiResponse.success(res, 200, result.message);
};

// ========== GRN Controllers ==========
const listGRNs = async (req, res) => {
  const result = await GRNService.list(req.query);
  ApiResponse.success(res, 200, "GRNs retrieved successfully", result);
};

const getGRN = async (req, res) => {
  const grn = await GRNService.get(req.params.id);
  ApiResponse.success(res, 200, "GRN retrieved successfully", grn);
};

const createGRN = async (req, res) => {
  const grn = await GRNService.create(req.body, req);
  ApiResponse.success(res, 201, "GRN created successfully", grn);
};

const updateGRN = async (req, res) => {
  const grn = await GRNService.update(req.params.id, req.body, req);
  ApiResponse.success(res, 200, "GRN updated successfully", grn);
};

const deleteGRN = async (req, res) => {
  const result = await GRNService.delete(req.params.id, req);
  ApiResponse.success(res, 200, result.message);
};

module.exports = {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorPurchaseHistory,
  listPurchaseRequests,
  getPurchaseRequest,
  createPurchaseRequest,
  updatePurchaseRequest,
  deletePurchaseRequest,
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  listGRNs,
  getGRN,
  createGRN,
  updateGRN,
  deleteGRN,
};
