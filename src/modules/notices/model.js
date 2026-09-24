const { db } = require("../../config/db");

class Notice {
  static collectionName = "notices";

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async create(data) {
    const now = new Date().toISOString();
    return db.collection(this.collectionName).insertOne({
      title: data.title,
      body: data.body,
      targetAudience: data.targetAudience,
      targetRoleIds: data.targetRoleIds || [],
      targetMemberIds: data.targetMemberIds || [],
      publishDate: data.publishDate,
      expiryDate: data.expiryDate || null,
      status: data.status || "Draft",
      publishedAt: data.status === "Published" ? now : null,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  }

  static async update(id, patch) {
    return db.collection(this.collectionName).updateOne(
      { _id: id },
      { ...patch, updatedAt: new Date().toISOString() }
    );
  }

  static async delete(id) {
    return db.collection(this.collectionName).deleteOne({ _id: id });
  }
}

module.exports = Notice;
