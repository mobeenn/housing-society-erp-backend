const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  createAttendanceSchema,
  bulkCreateAttendanceSchema,
  updateAttendanceSchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
} = require("./validation");
const {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listAttendance,
  getAttendance,
  createAttendance,
  bulkCreateAttendance,
  updateAttendance,
  deleteAttendance,
  listLeaveRequests,
  getLeaveRequest,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  getLeaveBalance,
} = require("./controller");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ══════════════════════════════════════════════════
// Employee Routes
// ══════════════════════════════════════════════════

router.get(
  "/employees",
  authorize("hr", "view"),
  listEmployees
);

router.get(
  "/employees/:id",
  authorize("hr", "view"),
  getEmployee
);

router.post(
  "/employees",
  authorize("hr", "create"),
  validate(createEmployeeSchema),
  createEmployee
);

router.put(
  "/employees/:id",
  authorize("hr", "edit"),
  validate(updateEmployeeSchema),
  updateEmployee
);

router.delete(
  "/employees/:id",
  authorize("hr", "delete"),
  deleteEmployee
);

// ══════════════════════════════════════════════════
// Attendance Routes
// ══════════════════════════════════════════════════

router.get(
  "/attendance",
  authorize("hr", "view"),
  listAttendance
);

router.get(
  "/attendance/:id",
  authorize("hr", "view"),
  getAttendance
);

router.post(
  "/attendance",
  authorize("hr", "edit"),
  validate(createAttendanceSchema),
  createAttendance
);

router.post(
  "/attendance/bulk",
  authorize("hr", "edit"),
  validate(bulkCreateAttendanceSchema),
  bulkCreateAttendance
);

router.put(
  "/attendance/:id",
  authorize("hr", "edit"),
  validate(updateAttendanceSchema),
  updateAttendance
);

router.delete(
  "/attendance/:id",
  authorize("hr", "delete"),
  deleteAttendance
);

// ══════════════════════════════════════════════════
// Leave Request Routes
// ══════════════════════════════════════════════════

router.get(
  "/leave-requests",
  authorize("hr", "view"),
  listLeaveRequests
);

router.get(
  "/leave-requests/:id",
  authorize("hr", "view"),
  getLeaveRequest
);

router.post(
  "/leave-requests",
  authorize("hr", "create"),
  validate(createLeaveRequestSchema),
  createLeaveRequest
);

router.put(
  "/leave-requests/:id",
  authorize("hr", "edit"),
  validate(updateLeaveRequestSchema),
  updateLeaveRequest
);

router.delete(
  "/leave-requests/:id",
  authorize("hr", "delete"),
  deleteLeaveRequest
);

router.get(
  "/employees/:employeeId/leave-balance",
  authorize("hr", "view"),
  getLeaveBalance
);

module.exports = router;
