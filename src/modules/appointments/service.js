const Appointment = require("./appointment.model");
const Employee = require("../hr/employee.model");
const NumberingRule = require("../administration/numberingRule.model");
const ApiError = require("../../utils/ApiError");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const todayString = () => new Date().toISOString().slice(0, 10);
const dateOf = (value) => value ? String(value).slice(0, 10) : "";

function paginate(rows, page = 1, limit = 50) {
  const currentPage = Math.max(1, number(page) || 1);
  const pageSize = Math.min(200, Math.max(1, number(limit) || 50));
  const start = (currentPage - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    pagination: { page: currentPage, limit: pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) },
  };
}

async function enrich(appointment) {
  if (!appointment) return null;
  const host = appointment.hostEmployee ? await Employee.findById(appointment.hostEmployee) : null;
  return {
    ...appointment,
    hostEmployeeRef: host ? {
      _id: host._id,
      employeeId: host.employeeId,
      name: host.name,
      department: host.department,
      designation: host.designation,
    } : null,
  };
}

class AppointmentService {
  static async ensureNumberingRule() {
    const entityType = NumberingRule.ENTITY_TYPES.APPOINTMENT;
    const existing = await NumberingRule.findByEntityType(entityType);
    if (existing) return existing;
    return NumberingRule.create({
      entityType,
      prefix: "APT",
      currentSequence: 0,
      padLength: 4,
      resetPolicy: NumberingRule.RESET_POLICIES.DAILY,
    });
  }

  static async nextTokenNumber() {
    await this.ensureNumberingRule();
    return NumberingRule.getNextNumber(NumberingRule.ENTITY_TYPES.APPOINTMENT);
  }

  static async list({ from, to, status, search, page = 1, limit = 50 } = {}) {
    const rows = await Appointment.find({}, { sort: { createdAt: -1 } });
    const query = String(search || "").trim().toLowerCase();
    const filtered = rows.filter((appointment) => {
      const appointmentDate = dateOf(appointment.checkInTime || appointment.createdAt);
      if (status && appointment.status !== status) return false;
      if (from && appointmentDate < from) return false;
      if (to && appointmentDate > to) return false;
      if (query && ![appointment.tokenNumber, appointment.visitorName, appointment.purpose].filter(Boolean).join(" ").toLowerCase().includes(query)) return false;
      return true;
    });
    const result = paginate(filtered, page, limit);
    result.data = await Promise.all(result.data.map(enrich));
    return result;
  }

  static async today() {
    const result = await this.list({ from: todayString(), to: todayString(), limit: 200 });
    return result.data;
  }

  static async get(id) {
    const appointment = await Appointment.findById(id);
    if (!appointment) throw new ApiError(404, "Appointment not found");
    return enrich(appointment);
  }

  static async hosts() {
    const employees = await Employee.find({ status: Employee.STATUSES.ACTIVE }, { sort: { name: 1 } });
    return employees.map((employee) => ({ _id: employee._id, employeeId: employee.employeeId, name: employee.name, department: employee.department, designation: employee.designation }));
  }

  static async create(data, req) {
    const host = await Employee.findById(data.hostEmployee);
    if (!host) throw new ApiError(400, "Host employee not found");
    if (host.status !== Employee.STATUSES.ACTIVE) throw new ApiError(400, "Host employee must be active");
    const tokenNumber = await this.nextTokenNumber();
    if (await Appointment.findByToken(tokenNumber)) throw new ApiError(409, "Appointment token collision; please retry");
    const appointment = await Appointment.create({
      visitorName: data.visitorName,
      purpose: data.purpose,
      hostEmployee: data.hostEmployee,
      tokenNumber,
      status: data.checkInTime ? Appointment.STATUS.IN_MEETING : Appointment.STATUS.WAITING,
      checkInTime: data.checkInTime || null,
      createdBy: req.user._id,
    });
    await createAuditLog({ req, entityType: "Appointment", entityId: appointment._id, action: AuditLog.ACTIONS.CREATE, changes: { after: appointment } });
    return this.get(appointment._id);
  }

  static async checkIn(id, req) {
    const appointment = await Appointment.findById(id);
    if (!appointment) throw new ApiError(404, "Appointment not found");
    if (appointment.status !== Appointment.STATUS.WAITING) throw new ApiError(409, `Only Waiting appointments can be checked in (current status: ${appointment.status})`);
    const checkInTime = new Date().toISOString();
    await Appointment.update(id, { status: Appointment.STATUS.IN_MEETING, checkInTime });
    await createAuditLog({ req, entityType: "Appointment", entityId: id, action: AuditLog.ACTIONS.STATUS_CHANGE, changes: { status: { before: appointment.status, after: Appointment.STATUS.IN_MEETING }, checkInTime } });
    return this.get(id);
  }

  static async checkOut(id, req) {
    const appointment = await Appointment.findById(id);
    if (!appointment) throw new ApiError(404, "Appointment not found");
    if (appointment.status !== Appointment.STATUS.IN_MEETING) throw new ApiError(409, `Only InMeeting appointments can be checked out (current status: ${appointment.status})`);
    const checkOutTime = new Date().toISOString();
    await Appointment.update(id, { status: Appointment.STATUS.DONE, checkOutTime });
    await createAuditLog({ req, entityType: "Appointment", entityId: id, action: AuditLog.ACTIONS.STATUS_CHANGE, changes: { status: { before: appointment.status, after: Appointment.STATUS.DONE }, checkOutTime } });
    return this.get(id);
  }
}

module.exports = AppointmentService;
