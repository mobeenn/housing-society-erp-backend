const { db } = require("../../config/db");

class JournalEntry {
  static collectionName = "journalEntries";

  static async find(query = {}, options = {}) {
    return db.collection(this.collectionName).find(query, options);
  }

  static async findOne(query) {
    return db.collection(this.collectionName).findOne(query);
  }

  static async findById(id) {
    return this.findOne({ _id: id });
  }

  static async findBySource(sourceType, sourceId) {
    return this.findOne({ sourceType, sourceId });
  }

  static async create(data) {
    return db.collection(this.collectionName).insertOne({
      date: data.date || new Date().toISOString().slice(0, 10),
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      description: data.description || "",
      lines: data.lines || [],
      totalDebit: Number(data.totalDebit || 0),
      totalCredit: Number(data.totalCredit || 0),
      status: data.status || "Posted",
      postedBy: data.postedBy || null,
    });
  }
}

module.exports = JournalEntry;
