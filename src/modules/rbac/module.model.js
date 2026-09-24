const { db } = require("../../config/db");
const ApiError = require("../../utils/ApiError");

class Module {
  static collectionName = "rbacModules";

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async findByKey(key) {
    return db.collection(this.collectionName).findOne({ key });
  }

  static async create(data) {
    if (!data.key?.trim()) throw new ApiError(400, "Module key is required");
    if (await this.findByKey(data.key)) throw new ApiError(409, "Module key already exists");
    const now = new Date().toISOString();
    return db.collection(this.collectionName).insertOne({
      key: data.key.trim(),
      label: data.label,
      description: data.description || "",
      group: data.group || "General",
      icon: data.icon || "Square",
      route: data.route || `/${data.key}`,
      showInSidebar: data.showInSidebar !== false,
      sortOrder: Number(data.sortOrder || 0),
      isActive: data.isActive !== false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static async update(key, patch) {
    return db.collection(this.collectionName).updateOne(
      { key },
      { ...patch, updatedAt: new Date().toISOString() }
    );
  }
}

module.exports = Module;
