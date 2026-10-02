const { db } = require("../../config/db");
const { v4: uuidv4 } = require("uuid");
const { Department } = require("../administration/masterData.model");

const collectionName = "employees";

class Employee {
  static get collectionName() {
    return collectionName;
  }

  static STATUSES = {
    ACTIVE: "Active",
    ON_LEAVE: "On Leave",
    RESIGNED: "Resigned",
    TERMINATED: "Terminated",
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

  /**
   * Map a department name to its id, case-insensitively.
   * Returns null when the department is not registered — an unregistered name
   * must not block employee creation.
   */
  static async resolveDepartmentId(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return null;
    const match = await Department.findOne({ name: trimmed });
    if (match) return match._id;
    const insensitive = (await Department.find({})).find(
      (d) => String(d.name || "").trim().toLowerCase() === trimmed.toLowerCase()
    );
    return insensitive?._id || null;
  }

  static async create(data, createdBy) {
    const employee = {
      _id: uuidv4(),
      employeeId: data.employeeId,
      name: data.name,
      cnic: data.cnic || null,
      phone: data.phone || null,
      email: data.email || null,
      department: data.department,
      // Resolve the free-text department name to a real departments row so the
      // employee is joinable. Left NULL when the name is not registered; the
      // API still displays `department`, so nothing changes for the caller.
      departmentId: await Employee.resolveDepartmentId(data.department),
      designation: data.designation,
      joiningDate: data.joiningDate,
      dateOfBirth: data.dateOfBirth || null,
      address: data.address || null,
      emergencyContact: data.emergencyContact || null,

      // Nullable link to User model (for system access)
      linkedUser: data.linkedUser || null,

      // Documents: array of {name, url, uploadedAt}
      documents: data.documents || [],

      // Payroll fields (optional/stubbed per SRS)
      basicSalary: data.basicSalary || null,
      allowances: data.allowances || null,
      deductions: data.deductions || null,
      bankAccount: data.bankAccount || null,
      salaryStructure: data.salaryStructure || [],

      status: data.status || Employee.STATUSES.ACTIVE,
      remarks: data.remarks || null,

      createdBy: createdBy || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await db.collection(collectionName).insertOne(employee);
    return { ...employee, _id: result.insertedId || employee._id };
  }

  static async update(id, patch) {
    patch.updatedAt = new Date().toISOString();
    return db.collection(collectionName).updateOne({ _id: id }, patch);
  }

  static async delete(id) {
    return db.collection(collectionName).deleteOne({ _id: id });
  }
}

module.exports = Employee;
