const { db } = require("../../config/db");

class Role {
  static collectionName = "roles";

  static async find(query = {}, options = {}) {
    return await db.collection(this.collectionName).find(query, options);
  }

  static async findById(id) {
    return await db.collection(this.collectionName).findOne({ _id: id });
  }

  static async findByName(name) {
    return await db.collection(this.collectionName).findOne({ name: name.trim() });
  }

  static async create(roleData) {
    const role = {
      name: roleData.name.trim(),
      description: roleData.description?.trim() || "",
      permissions: roleData.permissions || [],
      isSystem: roleData.isSystem || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await db.collection(this.collectionName).insertOne(role);
  }

  static async update(id, updateData) {
    const data = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };
    return await db.collection(this.collectionName).updateOne({ _id: id }, data);
  }

  static async delete(id) {
    return await db.collection(this.collectionName).deleteOne({ _id: id });
  }
}

module.exports = Role;
