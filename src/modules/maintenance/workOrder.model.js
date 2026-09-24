const { db } = require("../../config/db");
const { STATUSES, PRIORITIES } = require("./maintenance.config");

/**
 * WorkOrder Model (SRS Section 17)
 * { asset (ref Asset, nullable), relatedComplaint (ref Complaint, nullable —
 *   a complaint can spawn a work order), description, assignedStaff (ref User) /
 *   contractor, priority, expectedCompletion, materials: [{ item, quantity }],
 *   laborCost, materialCost, status (Open/InProgress/Completed/Cancelled),
 *   progressLog: [{ note, author, date }], completionNote, completedAt }
 */
class WorkOrder {
  static collectionName = "workOrders";

  static STATUS = STATUSES;
  static PRIORITIES = PRIORITIES;

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async count(query = {}) {
    return db.collection(this.collectionName).countDocuments(query);
  }

  static async create(data, createdBy) {
    return db.collection(this.collectionName).insertOne({
      asset: data.asset || null, // nullable — general work not tied to an asset
      relatedComplaint: data.relatedComplaint || null, // nullable — a complaint can spawn a work order
      description: data.description.trim(),
      assignedStaff: data.assignedStaff || null, // ref User
      contractor: data.contractor?.trim() || null, // external contractor name
      priority: data.priority,
      expectedCompletion: data.expectedCompletion || null,
      materials: (data.materials || []).map((material) => ({
        item: material.item,
        quantity: Number(material.quantity) || 0,
      })),
      laborCost: Number(data.laborCost) || 0,
      materialCost: Number(data.materialCost) || 0,
      status: STATUSES.OPEN,
      progressLog: [],
      completionNote: null,
      completedAt: null,
      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

module.exports = { WorkOrder };