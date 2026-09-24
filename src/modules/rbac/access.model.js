const { db } = require("../../config/db");

const ACTIONS = ["view", "create", "edit", "delete", "approve", "reject", "cancel", "print", "export", "refund"];
const defaultActions = () => Object.fromEntries(ACTIONS.map((action) => [action, false]));

class RoleModuleAccess {
  static collectionName = "roleModuleAccess";

  static normalizeActions(actions = {}) {
    return Object.fromEntries(
      ACTIONS.map((action) => [action, actions?.[action] === true])
    );
  }

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findForRole(roleId) {
    const records = await this.find({ role: roleId });
    return records;
  }

  static async findByRoleAndModule(roleId, moduleId) {
    return db.collection(this.collectionName).findOne({ role: roleId, module: moduleId });
  }

  static async deleteOne(query) {
    return db.collection(this.collectionName).deleteOne(query);
  }

  static async upsert(roleId, moduleId, data) {
    const now = new Date().toISOString();
    const isVisible = data.isVisible === true;
    const actions = isVisible ? this.normalizeActions(data.actions) : defaultActions();
    const record = {
      role: roleId,
      module: moduleId,
      isVisible,
      actions,
      updatedBy: data.updatedBy || null,
      updatedAt: now,
    };
    const existing = await this.findByRoleAndModule(roleId, moduleId);
    if (existing) {
      await db.collection(this.collectionName).updateOne(
        { _id: existing._id },
        { ...record, createdAt: existing.createdAt || now }
      );
      return this.findByRoleAndModule(roleId, moduleId);
    }
    return db.collection(this.collectionName).insertOne({
      ...(data._id ? { _id: data._id } : {}),
      ...record,
      createdAt: now,
    });
  }
}

module.exports = { RoleModuleAccess, ACTIONS, defaultActions };
