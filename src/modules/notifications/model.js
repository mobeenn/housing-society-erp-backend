const { db } = require("../../config/db");

class Notification {
  static collectionName = "notifications";

  static async findForUser(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const all = await db.collection(this.collectionName).find(
      unreadOnly ? { user: userId, isRead: false } : { user: userId },
      { sort: { createdAt: -1 } }
    );
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Number(limit) || 20);
    const start = (safePage - 1) * safeLimit;
    return {
      data: all.slice(start, start + safeLimit),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: all.length,
        pages: Math.ceil(all.length / safeLimit),
      },
    };
  }

  static async countUnread(userId) {
    return db.collection(this.collectionName).countDocuments({ user: userId, isRead: false });
  }

  static async findById(id) {
    return db.collection(this.collectionName).findOne({ _id: id });
  }

  static async findByEventKey(userId, eventKey) {
    if (!eventKey) return null;
    return db.collection(this.collectionName).findOne({ user: userId, eventKey });
  }

  static async create(data) {
    const now = new Date().toISOString();
    return db.collection(this.collectionName).insertOne({
      user: data.user,
      title: data.title,
      message: data.message,
      relatedEntityType: data.relatedEntityType || null,
      relatedEntityId: data.relatedEntityId || null,
      eventType: data.eventType || "general",
      eventKey: data.eventKey || null,
      metadata: data.metadata || {},
      isRead: false,
      readAt: null,
      createdBy: data.createdBy || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static async markRead(id, userId) {
    return db.collection(this.collectionName).updateOne(
      { _id: id, user: userId },
      {
        isRead: true,
        readAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  static async markAllRead(userId) {
    return db.collection(this.collectionName).updateMany(
      { user: userId, isRead: false },
      {
        isRead: true,
        readAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  static async delete(query) {
    return db.collection(this.collectionName).deleteMany(query);
  }
}

module.exports = Notification;
