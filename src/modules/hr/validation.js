const { z } = require("zod");
const Employee = require("./employee.model");
const Attendance = require("./attendance.model");
const LeaveRequest = require("./leaveRequest.model");

// Employee schemas
const createEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(2),
  cnic: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  department: z.string().min(1),
  designation: z.string().min(1),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "joiningDate must be YYYY-MM-DD"),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  linkedUser: z.string().optional().nullable(),
  documents: z.array(z.object({
    name: z.string(),
    url: z.string(),
    uploadedAt: z.string().optional(),
  })).optional(),
  basicSalary: z.number().optional().nullable(),
  allowances: z.record(z.string(), z.number()).optional().nullable(),
  deductions: z.record(z.string(), z.number()).optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  salaryStructure: z.array(z.object({
    component: z.string().min(1),
    amount: z.number().nonnegative(),
  })).optional(),
  status: z.enum(Object.values(Employee.STATUSES)).optional(),
  remarks: z.string().optional().nullable(),
});

const updateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  department: z.string().min(1).optional(),
  designation: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  linkedUser: z.string().optional().nullable(),
  documents: z.array(z.object({
    name: z.string(),
    url: z.string(),
    uploadedAt: z.string().optional(),
  })).optional(),
  basicSalary: z.number().optional().nullable(),
  allowances: z.record(z.string(), z.number()).optional().nullable(),
  deductions: z.record(z.string(), z.number()).optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  salaryStructure: z.array(z.object({
    component: z.string().min(1),
    amount: z.number().nonnegative(),
  })).optional(),
  status: z.enum(Object.values(Employee.STATUSES)).optional(),
  remarks: z.string().optional().nullable(),
});

// Attendance schemas
const createAttendanceSchema = z.object({
  employee: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(Object.values(Attendance.STATUSES)),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const bulkCreateAttendanceSchema = z.object({
  records: z.array(createAttendanceSchema).min(1),
});

const updateAttendanceSchema = z.object({
  status: z.enum(Object.values(Attendance.STATUSES)).optional(),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

// Leave Request schemas
const createLeaveRequestSchema = z.object({
  employee: z.string().min(1),
  type: z.enum(Object.values(LeaveRequest.LEAVE_TYPES)),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(3),
});

const updateLeaveRequestSchema = z.object({
  status: z.enum(Object.values(LeaveRequest.STATUSES)).optional(),
  rejectionReason: z.string().optional().nullable(),
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  createAttendanceSchema,
  bulkCreateAttendanceSchema,
  updateAttendanceSchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
};
