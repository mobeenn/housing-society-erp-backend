const { db } = require("../../config/db");
const NumberingRule = require("../administration/numberingRule.model");

class Plot {
  static collectionName = "plots";

  static STATUS = {
    AVAILABLE: "Available",
    RESERVED: "Reserved",
    BOOKED: "Booked",
    ALLOTTED: "Allotted",
    SOLD: "Sold",
    TRANSFERRED: "Transferred",
    CANCELLED: "Cancelled",
    POSSESSED: "Possessed",
    UNDER_CONSTRUCTION: "Under Construction",
    CONSTRUCTED: "Constructed",
    MERGED: "Merged",
    BOUGHT_BACK: "BoughtBack",
  };

  static PROPERTY_TYPES = ["residential", "commercial"];

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findOne(query = {}) {
    return db.collection(this.collectionName).findOne(query);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async create(data, createdBy) {
    const plotNumber = await NumberingRule.getNextNumber("plot");
    return db.collection(this.collectionName).insertOne({
      plotNumber,
      block: data.block,
      street: data.street,
      size: data.size,
      category: data.category,
      propertyType: data.propertyType,
      fileNumber: data.fileNumber?.trim() || null,
      location: data.location?.trim() || null,
      currentOwner: data.currentOwner || null,
      ownerSince: data.currentOwner ? new Date().toISOString() : null,
      status: data.status || this.STATUS.AVAILABLE,
      isBlocked: Boolean(data.isBlocked),
      mergedIntoPlot: data.mergedIntoPlot || null,
      mergedFromPlots: data.mergedFromPlots || [],
      lifecycleAction: data.lifecycleAction || null,
      lifecycleRecord: data.lifecycleRecord || null,
      price: data.price,
      createdBy,
    });
  }

  static async update(id, data) {
    const updateData = { updatedAt: new Date().toISOString() };
    ["block", "street", "size", "category", "propertyType", "price"].forEach((field) => {
      if (data[field] !== undefined) updateData[field] = data[field];
    });
    if (data.fileNumber !== undefined) updateData.fileNumber = data.fileNumber?.trim() || null;
    if (data.location !== undefined) updateData.location = data.location?.trim() || null;
    if (data.currentOwner !== undefined) updateData.currentOwner = data.currentOwner || null;
    if (data.ownerSince !== undefined) updateData.ownerSince = data.ownerSince;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isBlocked !== undefined) updateData.isBlocked = Boolean(data.isBlocked);
    ["mergedIntoPlot", "lifecycleAction", "lifecycleRecord"].forEach((field) => {
      if (data[field] !== undefined) updateData[field] = data[field];
    });
    if (data.mergedFromPlots !== undefined) updateData.mergedFromPlots = data.mergedFromPlots;
    return db.collection(this.collectionName).updateOne({ _id: id }, updateData);
  }

  static async delete(id) {
    return db.collection(this.collectionName).deleteOne({ _id: id });
  }
}

class OwnershipHistory {
  static collectionName = "ownershipHistory";

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findOne(query = {}) {
    return db.collection(this.collectionName).findOne(query);
  }

  static async close(id, toDate) {
    return db.collection(this.collectionName).updateOne({ _id: id }, { toDate });
  }

  static async append(data) {
    return db.collection(this.collectionName).insertOne({
      plot: data.plot,
      member: data.member,
      fromDate: data.fromDate,
      toDate: data.toDate || null,
      type: data.type,
      remarks: data.remarks?.trim() || null,
    });
  }
}

module.exports = { Plot, OwnershipHistory };