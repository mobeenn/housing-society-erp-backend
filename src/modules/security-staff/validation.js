const { z } = require("zod");
const { SHIFTS, GUARD_STATUSES, ATTENDANCE_STATUSES } = require("./security.config");

const createGuardSchema = z.object({
  user: z.string().optional().nullable(), // optional — guards may log in
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  supervisor: z.string().optional().nullable(), // ref User
  shift: z.enum(SHIFTS),
  status: z.enum(GUARD_STATUSES).optional(),
});

const updateGuardSchema = z.object({
  user: z.string().optional().nullable(),
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  supervisor: z.string().optional().nullable(),
  shift: z.enum(SHIFTS).optional(),
  status: z.enum(GUARD_STATUSES).optional(),
});

/** Assign (upsert) a guard's shift for a date on the duty roster. */
const assignRosterSchema = z.object({
  guard: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  shift: z.enum(SHIFTS),
});

/** Mark attendance for a guard on a date (upserts the roster entry). */
const attendanceSchema = z.object({
  guard: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  attendanceStatus: z.enum(ATTENDANCE_STATUSES),
});

module.exports = {
  createGuardSchema,
  updateGuardSchema,
  assignRosterSchema,
  attendanceSchema,
  SHIFTS,
  GUARD_STATUSES,
  ATTENDANCE_STATUSES,
};