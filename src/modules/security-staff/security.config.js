/**
 * Security staff module configuration (SRS Section 18)
 * - Guard shifts and statuses
 * - Duty roster attendance statuses
 */

const SHIFTS = ["Morning", "Evening", "Night"];

const GUARD_STATUSES = ["Active", "Inactive", "Suspended"];

const ATTENDANCE_STATUSES = ["Present", "Absent", "Leave"];

module.exports = { SHIFTS, GUARD_STATUSES, ATTENDANCE_STATUSES };