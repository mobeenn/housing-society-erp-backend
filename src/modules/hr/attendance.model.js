const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");

const collectionName = "attendance";

class Attendance {
  static get collectionName() {
    return collectionName;
  }

  static STATUSES = {
    PRESENT: "Present",
    ABSENT: "Absent",
    HALF_DAY: "Half Day",
    LEAVE: "Leave",
    HOLIDAY: "Holiday",
  };

  static async find(query = {}, options = {}) {
    return db.collection(collectionName).find(query, options);
  }

  static async findOne(query) {
    return db.collection(collectionName).findOne(query);
  }

  static async findById(id) {
    return db.collection(collectionName).findOne({ _id: id });
  }

  static async create(data, createdBy) {
    const attendance = {
      _id: uuidv4(),
      employee: data.employee,
      date: data.date,
      status: data.status || Attendance.STATUSES.PRESENT,
      checkIn: data.checkIn || null,
      checkOut: data.checkOut || null,
      remarks: data.remarks || null,

      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(attendance);
    return { ...attendance, _id: result.insertedId || attendance._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }

  static async bulkCreate(records, createdBy) {
    const docs = records.map((data) => ({
      _id: uuidv4(),
      employee: data.employee,
      date: data.date,
      status: data.status || Attendance.STATUSES.PRESENT,
      checkIn: data.checkIn || null,
      checkOut: data.checkOut || null,
      remarks: data.remarks || null,
      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const result = await db.collection(collectionName).insertMany(docs);
    return docs;
  }
}

module.exports = Attendance;
