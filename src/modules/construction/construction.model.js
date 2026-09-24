const { db } = require("../../config/db");

class ConstructionApplication {
  static collectionName = "constructionApplications";
  static STATUS = { APPLIED: "Applied", UNDER_REVIEW: "UnderReview", APPROVED: "Approved", REJECTED: "Rejected" };
  static TYPES = ["Construction", "Renovation", "Demolition", "BoundaryWall"];
  static async find(query = {}, options = {}) { return db.collection(this.collectionName).find(query, options); }
  static async findById(id) { return db.collection(this.collectionName).findOne({ _id: id }); }
  static async create(data, createdBy) { return db.collection(this.collectionName).insertOne({ ...data, status: this.STATUS.APPLIED, reviewStatus: "Pending", createdBy, completionCertificateUrl: null }); }
  static async update(id, data) { return db.collection(this.collectionName).updateOne({ _id: id }, data); }
}

class SiteInspection {
  static collectionName = "siteInspections";
  static async find(query = {}, options = {}) { return db.collection(this.collectionName).find(query, options); }
  static async findById(id) { return db.collection(this.collectionName).findOne({ _id: id }); }
  static async create(data) { return db.collection(this.collectionName).insertOne({ ...data, violations: data.violations || [], correctiveActionsRequired: Boolean(data.correctiveActionsRequired), reinspectionRequired: Boolean(data.reinspectionRequired) }); }
  static async update(id, data) { return db.collection(this.collectionName).updateOne({ _id: id }, data); }
}

module.exports = { ConstructionApplication, SiteInspection };