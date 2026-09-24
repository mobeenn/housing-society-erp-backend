const Employee = require("./employee.model");
const Attendance = require("./attendance.model");
const LeaveRequest = require("./leaveRequest.model");
const User = require("../auth/user.model");
const { createAuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");
const NotificationService = require("../notifications/service");

/** Enrich employee with linked user reference */
const enrichEmployee = async (employee) => {
  if (!employee.linkedUser) return employee;
  const user = await User.findById(employee.linkedUser);
  return { ...employee, linkedUserRef: user };
};

/** Enrich attendance with employee reference */
const enrichAttendance = async (attendance) => {
  const employee = await Employee.findById(attendance.employee);
  return { ...attendance, employeeRef: employee };
};

/** Enrich leave request with employee and approver references */
const enrichLeaveRequest = async (request) => {
  const [employee, approver] = await Promise.all([
    Employee.findById(request.employee),
    request.approvedBy ? User.findById(request.approvedBy) : null,
  ]);
  return { ...request, employeeRef: employee, approverRef: approver };
};

class EmployeeService {
  static async list({ q, department, designation, status, page = 1, limit = 50 } = {}) {
    const query = {};
    if (department) query.department = department;
    if (designation) query.designation = designation;
    if (status) query.status = status;

    const all = await Employee.find(query, { sort: { joiningDate: -1 } });

    // Text search across name, employeeId, phone, email
    const filtered = q
      ? all.filter((emp) =>
          [emp.name, emp.employeeId, emp.phone, emp.email, emp.cnic]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(String(q).toLowerCase())
        )
      : all;

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = filtered.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((emp) => enrichEmployee(emp))),
      pagination: {
        page: p,
        limit: l,
        total: filtered.length,
        pages: Math.ceil(filtered.length / l),
      },
    };
  }

  static async get(id) {
    const employee = await Employee.findById(id);
    if (!employee) throw new ApiError(404, "Employee not found");
    return enrichEmployee(employee);
  }

  static async create(data, req) {
    // Check for duplicate employeeId
    const existing = await Employee.findOne({ employeeId: data.employeeId });
    if (existing) throw new ApiError(400, "Employee ID already exists");

    // Validate linkedUser if provided
    if (data.linkedUser) {
      const user = await User.findById(data.linkedUser);
      if (!user) throw new ApiError(400, "Linked user not found");
    }

    const employee = await Employee.create(data, req.user._id);

    await createAuditLog({
      userId: req.user._id,
      action: "CREATE",
      resource: "Employee",
      resourceId: employee._id,
      details: { employeeId: employee.employeeId, name: employee.name },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return enrichEmployee(employee);
  }

  static async update(id, patch, req) {
    const employee = await Employee.findById(id);
    if (!employee) throw new ApiError(404, "Employee not found");

    // Validate linkedUser if being updated
    if (patch.linkedUser) {
      const user = await User.findById(patch.linkedUser);
      if (!user) throw new ApiError(400, "Linked user not found");
    }

    await Employee.update(id, patch);

    await createAuditLog({
      userId: req.user._id,
      action: "UPDATE",
      resource: "Employee",
      resourceId: id,
      details: { changes: Object.keys(patch) },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return this.get(id);
  }

  static async delete(id, req) {
    const employee = await Employee.findById(id);
    if (!employee) throw new ApiError(404, "Employee not found");

    await Employee.delete(id);

    await createAuditLog({
      userId: req.user._id,
      action: "DELETE",
      resource: "Employee",
      resourceId: id,
      details: { employeeId: employee.employeeId, name: employee.name },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return { message: "Employee deleted successfully" };
  }
}

class AttendanceService {
  static async list({ employee, date, from, to, status, page = 1, limit = 100 } = {}) {
    const query = {};
    if (employee) query.employee = employee;
    if (status) query.status = status;

    // Single date or date range
    if (date) {
      query.date = date;
    } else if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const all = await Attendance.find(query, { sort: { date: -1, employee: 1 } });

    const p = Number(page) || 1;
    const l = Number(limit) || 100;
    const slice = all.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((att) => enrichAttendance(att))),
      pagination: {
        page: p,
        limit: l,
        total: all.length,
        pages: Math.ceil(all.length / l),
      },
    };
  }

  static async get(id) {
    const attendance = await Attendance.findById(id);
    if (!attendance) throw new ApiError(404, "Attendance record not found");
    return enrichAttendance(attendance);
  }

  static async create(data, req) {
    // Validate employee exists
    const employee = await Employee.findById(data.employee);
    if (!employee) throw new ApiError(400, "Employee not found");

    // Check for duplicate (same employee + date)
    const existing = await Attendance.findOne({
      employee: data.employee,
      date: data.date,
    });
    if (existing) throw new ApiError(400, "Attendance already marked for this employee on this date");

    const attendance = await Attendance.create(data, req.user._id);

    await createAuditLog({
      userId: req.user._id,
      action: "CREATE",
      resource: "Attendance",
      resourceId: attendance._id,
      details: { employee: data.employee, date: data.date, status: data.status },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return enrichAttendance(attendance);
  }

  static async bulkCreate(records, req) {
    // Validate all employees exist
    const employeeIds = [...new Set(records.map((r) => r.employee))];
    const employees = await Promise.all(employeeIds.map((id) => Employee.findById(id)));
    if (employees.some((e) => !e)) {
      throw new ApiError(400, "One or more employees not found");
    }

    // Check for duplicates in the request
    const keys = records.map((r) => `${r.employee}-${r.date}`);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      throw new ApiError(400, "Duplicate employee-date combinations in request");
    }

    // Check for existing records
    const existingChecks = await Promise.all(
      records.map((r) =>
        Attendance.findOne({ employee: r.employee, date: r.date })
      )
    );
    if (existingChecks.some((e) => e)) {
      throw new ApiError(400, "Attendance already exists for one or more employee-date combinations");
    }

    const created = await Attendance.bulkCreate(records, req.user._id);

    await createAuditLog({
      userId: req.user._id,
      action: "BULK_CREATE",
      resource: "Attendance",
      resourceId: null,
      details: { count: created.length, date: records[0]?.date },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return {
      data: await Promise.all(created.map((att) => enrichAttendance(att))),
      count: created.length,
    };
  }

  static async update(id, patch, req) {
    const attendance = await Attendance.findById(id);
    if (!attendance) throw new ApiError(404, "Attendance record not found");

    await Attendance.update(id, patch);

    await createAuditLog({
      userId: req.user._id,
      action: "UPDATE",
      resource: "Attendance",
      resourceId: id,
      details: { changes: Object.keys(patch) },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return this.get(id);
  }

  static async delete(id, req) {
    const attendance = await Attendance.findById(id);
    if (!attendance) throw new ApiError(404, "Attendance record not found");

    await Attendance.delete(id);

    await createAuditLog({
      userId: req.user._id,
      action: "DELETE",
      resource: "Attendance",
      resourceId: id,
      details: { employee: attendance.employee, date: attendance.date },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return { message: "Attendance record deleted successfully" };
  }
}

class LeaveRequestService {
  /**
   * Calculate leave balance for an employee by leave type
   * Returns { type: { total, used, available } }
   */
  static async calculateLeaveBalance(employeeId) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new ApiError(404, "Employee not found");

    // Default annual leave allowances (can be made configurable later)
    const defaultAllowances = {
      Annual: 20,
      Sick: 10,
      Casual: 10,
      Unpaid: 999, // No limit on unpaid
      Maternity: 90,
      Paternity: 14,
    };

    // Get all approved leaves for this employee in current year
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const approvedLeaves = await LeaveRequest.find({
      employee: employeeId,
      status: LeaveRequest.STATUSES.APPROVED,
      fromDate: { $gte: yearStart },
      toDate: { $lte: yearEnd },
    });

    // Calculate days used per type
    const usedByType = {};
    for (const leave of approvedLeaves) {
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);
      const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

      usedByType[leave.type] = (usedByType[leave.type] || 0) + days;
    }

    // Build balance object
    const balance = {};
    for (const type of Object.keys(defaultAllowances)) {
      const total = defaultAllowances[type];
      const used = usedByType[type] || 0;
      balance[type] = {
        total,
        used,
        available: total - used,
      };
    }

    return balance;
  }

  static async list({ employee, type, status, from, to, page = 1, limit = 50 } = {}) {
    const query = {};
    if (employee) query.employee = employee;
    if (type) query.type = type;
    if (status) query.status = status;

    // Date range
    if (from || to) {
      query.fromDate = {};
      if (from) query.fromDate.$gte = from;
      if (to) query.fromDate.$lte = to;
    }

    const all = await LeaveRequest.find(query, { sort: { createdAt: -1 } });

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = all.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((req) => enrichLeaveRequest(req))),
      pagination: {
        page: p,
        limit: l,
        total: all.length,
        pages: Math.ceil(all.length / l),
      },
    };
  }

  static async get(id) {
    const request = await LeaveRequest.findById(id);
    if (!request) throw new ApiError(404, "Leave request not found");
    return enrichLeaveRequest(request);
  }

  static async create(data, req) {
    // Validate employee exists
    const employee = await Employee.findById(data.employee);
    if (!employee) throw new ApiError(400, "Employee not found");

    // Validate date range
    if (data.fromDate > data.toDate) {
      throw new ApiError(400, "From date cannot be after to date");
    }

    // Calculate leave balance and capture snapshot
    const balance = await this.calculateLeaveBalance(data.employee);
    const balanceSnapshot = balance[data.type];

    // Calculate requested days
    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);
    const requestedDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

    // Check if sufficient balance (except for unpaid leave)
    if (data.type !== "Unpaid" && balanceSnapshot.available < requestedDays) {
      throw new ApiError(
        400,
        `Insufficient leave balance. Available: ${balanceSnapshot.available} days, Requested: ${requestedDays} days`
      );
    }

    const leaveRequest = await LeaveRequest.create(
      { ...data, balanceSnapshot },
      req.user._id
    );

    await createAuditLog({
      userId: req.user._id,
      action: "CREATE",
      resource: "LeaveRequest",
      resourceId: leaveRequest._id,
      details: {
        employee: data.employee,
        type: data.type,
        fromDate: data.fromDate,
        toDate: data.toDate,
        days: requestedDays,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    await NotificationService.safeNotifyPermission("staff:edit", {
      title: "Leave request requires review",
      message: `${employee.name} submitted a ${data.type.toLowerCase()} leave request.`,
      relatedEntityType: "LeaveRequest",
      relatedEntityId: leaveRequest._id,
      eventType: "leave.created",
      eventKey: `leave-created:${leaveRequest._id}`,
    });
    if (employee.linkedUser) {
      await NotificationService.safeNotifyUsers([employee.linkedUser], {
        title: "Leave request submitted",
        message: `Your ${data.type.toLowerCase()} leave request was submitted for review.`,
        relatedEntityType: "LeaveRequest",
        relatedEntityId: leaveRequest._id,
        eventType: "leave.created.employee",
        eventKey: `leave-created-employee:${leaveRequest._id}`,
      });
    }

    return enrichLeaveRequest(leaveRequest);
  }

  static async update(id, patch, req) {
    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) throw new ApiError(404, "Leave request not found");

    // If approving, set approver and timestamp
    if (patch.status === LeaveRequest.STATUSES.APPROVED) {
      patch.approvedBy = req.user._id;
      patch.approvedAt = new Date().toISOString();
    }

    await LeaveRequest.update(id, patch);

    await createAuditLog({
      userId: req.user._id,
      action: "UPDATE",
      resource: "LeaveRequest",
      resourceId: id,
      details: { changes: Object.keys(patch), newStatus: patch.status },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    if ([LeaveRequest.STATUSES.APPROVED, LeaveRequest.STATUSES.REJECTED, LeaveRequest.STATUSES.CANCELLED].includes(patch.status)) {
      const employee = await Employee.findById(leaveRequest.employee);
      if (employee?.linkedUser) {
        await NotificationService.safeNotifyUsers([employee.linkedUser], {
          title: `Leave request ${patch.status.toLowerCase()}`,
          message: `Your ${leaveRequest.type.toLowerCase()} leave request was ${patch.status.toLowerCase()}.`,
          relatedEntityType: "LeaveRequest",
          relatedEntityId: id,
          eventType: `leave.${patch.status.toLowerCase()}`,
          eventKey: `leave-${patch.status.toLowerCase()}:${id}`,
        });
      }
    }

    return this.get(id);
  }

  static async delete(id, req) {
    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) throw new ApiError(404, "Leave request not found");

    await LeaveRequest.delete(id);

    await createAuditLog({
      userId: req.user._id,
      action: "DELETE",
      resource: "LeaveRequest",
      resourceId: id,
      details: {
        employee: leaveRequest.employee,
        type: leaveRequest.type,
        fromDate: leaveRequest.fromDate,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return { message: "Leave request deleted successfully" };
  }
}

module.exports = {
  EmployeeService,
  AttendanceService,
  LeaveRequestService,
};
