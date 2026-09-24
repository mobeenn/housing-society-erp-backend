const { EmployeeService, AttendanceService, LeaveRequestService } = require("./service");
const ApiResponse = require("../../utils/apiResponse");

// ══════════════════════════════════════════════════
// Employee Controllers
// ══════════════════════════════════════════════════

const listEmployees = async (req, res) => {
  const result = await EmployeeService.list(req.query);
  ApiResponse.success(res, 200, "Employees retrieved successfully", result);
};

const getEmployee = async (req, res) => {
  const employee = await EmployeeService.get(req.params.id);
  ApiResponse.success(res, 200, "Employee retrieved successfully", employee);
};

const createEmployee = async (req, res) => {
  const employee = await EmployeeService.create(req.body, req);
  ApiResponse.success(res, 201, "Employee created successfully", employee);
};

const updateEmployee = async (req, res) => {
  const employee = await EmployeeService.update(req.params.id, req.body, req);
  ApiResponse.success(res, 200, "Employee updated successfully", employee);
};

const deleteEmployee = async (req, res) => {
  const result = await EmployeeService.delete(req.params.id, req);
  ApiResponse.success(res, 200, result.message);
};

// ══════════════════════════════════════════════════
// Attendance Controllers
// ══════════════════════════════════════════════════

const listAttendance = async (req, res) => {
  const result = await AttendanceService.list(req.query);
  ApiResponse.success(res, 200, "Attendance records retrieved successfully", result);
};

const getAttendance = async (req, res) => {
  const attendance = await AttendanceService.get(req.params.id);
  ApiResponse.success(res, 200, "Attendance record retrieved successfully", attendance);
};

const createAttendance = async (req, res) => {
  const attendance = await AttendanceService.create(req.body, req);
  ApiResponse.success(res, 201, "Attendance marked successfully", attendance);
};

const bulkCreateAttendance = async (req, res) => {
  const result = await AttendanceService.bulkCreate(req.body.records, req);
  ApiResponse.success(res, 201, `${result.count} attendance records created successfully`, result);
};

const updateAttendance = async (req, res) => {
  const attendance = await AttendanceService.update(req.params.id, req.body, req);
  ApiResponse.success(res, 200, "Attendance record updated successfully", attendance);
};

const deleteAttendance = async (req, res) => {
  const result = await AttendanceService.delete(req.params.id, req);
  ApiResponse.success(res, 200, result.message);
};

// ══════════════════════════════════════════════════
// Leave Request Controllers
// ══════════════════════════════════════════════════

const listLeaveRequests = async (req, res) => {
  const result = await LeaveRequestService.list(req.query);
  ApiResponse.success(res, 200, "Leave requests retrieved successfully", result);
};

const getLeaveRequest = async (req, res) => {
  const request = await LeaveRequestService.get(req.params.id);
  ApiResponse.success(res, 200, "Leave request retrieved successfully", request);
};

const createLeaveRequest = async (req, res) => {
  const request = await LeaveRequestService.create(req.body, req);
  ApiResponse.success(res, 201, "Leave request submitted successfully", request);
};

const updateLeaveRequest = async (req, res) => {
  const request = await LeaveRequestService.update(req.params.id, req.body, req);
  ApiResponse.success(res, 200, "Leave request updated successfully", request);
};

const deleteLeaveRequest = async (req, res) => {
  const result = await LeaveRequestService.delete(req.params.id, req);
  ApiResponse.success(res, 200, result.message);
};

const getLeaveBalance = async (req, res) => {
  const balance = await LeaveRequestService.calculateLeaveBalance(req.params.employeeId);
  ApiResponse.success(res, 200, "Leave balance retrieved successfully", balance);
};

module.exports = {
  // Employee
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,

  // Attendance
  listAttendance,
  getAttendance,
  createAttendance,
  bulkCreateAttendance,
  updateAttendance,
  deleteAttendance,

  // Leave Requests
  listLeaveRequests,
  getLeaveRequest,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  getLeaveBalance,
};
