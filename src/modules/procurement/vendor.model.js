const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "vendors";

class Vendor {
  static get collectionName() {
    return collectionName;
  }

  static STATUSES = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    BLACKLISTED: "Blacklisted",
  };

  static CATEGORIES = {
    CONSTRUCTION: "Construction",
    ELECTRICAL: "Electrical",
    PLUMBING: "Plumbing",
    SECURITY: "Security",
    CLEANING: "Cleaning",
    IT: "IT",
    STATIONERY: "Stationery",
    GENERAL: "General",
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
    const vendor = {
      _id: uuidv4(),
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      category: data.category,
      taxId: data.taxId || null,
      ntn: data.ntn || null,

      // Array of document refs
      documents: data.documents || [],

      // Payment terms
      paymentTerms: data.paymentTerms || null,

      status: data.status || Vendor.STATUSES.ACTIVE,
      performanceNotes: data.performanceNotes || null,

      // Outstanding balance computed from linked expenses/invoices
      outstandingBalance: 0,

      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(vendor);
    return { ...vendor, _id: result.insertedId || vendor._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }

  /**
   * Compute outstanding balance from linked purchase orders and expenses
   */
  static async computeOutstandingBalance(vendorId) {
    // Sum of PO amounts where status = Completed and payment not fully received
    const purchaseOrders = await db
      .collection("purchaseOrders")
      .find({ selectedVendor: vendorId, status: "Completed" });

    // Sum of expenses linked to this vendor that are unpaid
    const expenses = await db
      .collection("expenses")
      .find({ vendor: vendorId, paymentStatus: { $ne: "Paid" } });

    const poTotal = purchaseOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
    const expenseTotal = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return poTotal + expenseTotal;
  }
}

module.exports = Vendor;
