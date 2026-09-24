const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "purchaseOrders";

class PurchaseOrder {
  static get collectionName() {
    return collectionName;
  }

  static STATUSES = {
    DRAFT: "Draft",
    APPROVED: "Approved",
    SENT: "Sent",
    PARTIALLY_RECEIVED: "PartiallyReceived",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };

  static async find(query = {}, options = {}) {
    return db.collection(collectionName).find(query, options);
  }

  static async findOne(query) {
    return db.collection(collectionName).findOne(query);
  }

  static async findById(id) {
    return db.collection(collectionName).findOne({ _id: id });
  }

  static async create(data, createdBy) {
    const purchaseOrder = {
      _id: uuidv4(),
      poNumber: data.poNumber, // from numbering rule
      purchaseRequest: data.purchaseRequest, // ref PurchaseRequest
      selectedVendor: data.selectedVendor, // ref Vendor
      selectedQuotation: data.selectedQuotation || null, // ref Quotation

      // Items list
      items: data.items || [], // [{ item, quantity, unitPrice, totalPrice, description }]
      totalAmount: data.totalAmount,
      currency: data.currency || "PKR",

      paymentTerms: data.paymentTerms || null,
      deliveryTerms: data.deliveryTerms || null,
      deliveryDate: data.deliveryDate || null,

      status: data.status || PurchaseOrder.STATUSES.DRAFT,

      // Approvals and transitions
      approvedBy: data.approvedBy || null,
      approvedAt: data.approvedAt || null,
      sentAt: data.sentAt || null,
      completedAt: data.completedAt || null,
      cancelledAt: data.cancelledAt || null,
      cancellationReason: data.cancellationReason || null,

      documents: data.documents || [],
      remarks: data.remarks || null,

      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(purchaseOrder);
    return { ...purchaseOrder, _id: result.insertedId || purchaseOrder._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }
}

module.exports = PurchaseOrder;
