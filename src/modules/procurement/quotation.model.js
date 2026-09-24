const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "quotations";

class Quotation {
  static get collectionName() {
    return collectionName;
  }

  static STATUSES = {
    SUBMITTED: "Submitted",
    SELECTED: "Selected",
    REJECTED: "Rejected",
    EXPIRED: "Expired",
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
    const quotation = {
      _id: uuidv4(),
      quotationNumber: data.quotationNumber, // from numbering rule
      purchaseRequest: data.purchaseRequest, // ref PurchaseRequest
      vendor: data.vendor, // ref Vendor

      // Quotation details
      items: data.items || [], // [{ description, quantity, unitPrice, totalPrice }]
      amount: data.amount,
      currency: data.currency || "PKR",

      validUntil: data.validUntil,

      // Terms
      paymentTerms: data.paymentTerms || null,
      deliveryTerms: data.deliveryTerms || null,
      warrantyTerms: data.warrantyTerms || null,

      // Attached documents/quotation PDFs
      documents: data.documents || [],

      status: data.status || Quotation.STATUSES.SUBMITTED,
      remarks: data.remarks || null,

      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(quotation);
    return { ...quotation, _id: result.insertedId || quotation._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }
}

module.exports = Quotation;
