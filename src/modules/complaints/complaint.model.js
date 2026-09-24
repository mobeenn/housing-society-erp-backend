const { db } = require("../../config/db");
const { STATUSES, PRIORITIES } = require("./complaint.config");

/**
 * Complaint Model (SRS Section 16)
 * { member, plot (nullable), category, description, location, priority,
 *   attachments: [ref Document], assignedDepartment (ref),
 *   assignedStaff (ref User), slaDueDate, status, comments[], resolutionNote, resolvedAt }
 */
class Complaint {
  static collectionName = "complaints";

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
      complaintNumber: data.complaintNumber || null,
      member: data.member,
      plot: data.plot || null, // nullable — common-area complaints have no plot
      category: data.category,
      description: data.description,
      location: data.location?.trim() || null,
      priority: data.priority,
      attachments: data.attachments || [], // [ref Document]
      assignedDepartment: data.assignedDepartment || null, // auto-assigned default dept
      assignedStaff: null,
      slaDueDate: data.slaDueDate,
      status: STATUSES.NEW,
      comments: [],
      resolutionNote: null,
      resolvedAt: null,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  static async update(id, data) {
    return db.collection(this.collectionName).updateOne({ _id: id }, data);
  }
}

module.exports = { Complaint };