/**
 * Complaint configuration (SRS Section 16)
 * - Category -> default department (auto-assignment rule)
 * - Category + Priority -> SLA hours (used to compute slaDueDate)
 */

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const STATUSES = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "InProgress",
  RESOLVED: "Resolved",
  REOPENED: "Reopened",
  CLOSED: "Closed",
};

const OPEN_STATUSES = [
  STATUSES.NEW,
  STATUSES.ASSIGNED,
  STATUSES.IN_PROGRESS,
  STATUSES.REOPENED,
];

const DEFAULT_SLA_HOURS = { Low: 72, Medium: 48, High: 24, Urgent: 8 };

// Each category maps to a department code (seeded master data) and an SLA matrix.
const CATEGORIES = {
  Sanitation: {
    label: "Sanitation",
    defaultDepartmentCode: "OPS",
    slaHours: { ...DEFAULT_SLA_HOURS },
  },
  Electricity: {
    label: "Electricity",
    defaultDepartmentCode: "OPS",
    slaHours: { ...DEFAULT_SLA_HOURS, Medium: 36, High: 12, Urgent: 4 },
  },
  "Water & Sewerage": {
    label: "Water & Sewerage",
    defaultDepartmentCode: "OPS",
    slaHours: { ...DEFAULT_SLA_HOURS, High: 12, Urgent: 6 },
  },
  "Roads & Infrastructure": {
    label: "Roads & Infrastructure",
    defaultDepartmentCode: "OPS",
    slaHours: { ...DEFAULT_SLA_HOURS, Low: 120, Medium: 72 },
  },
  Security: {
    label: "Security",
    defaultDepartmentCode: "SEC",
    slaHours: { ...DEFAULT_SLA_HOURS, Medium: 24, High: 6, Urgent: 2 },
  },
  Noise: {
    label: "Noise",
    defaultDepartmentCode: "SEC",
    slaHours: { ...DEFAULT_SLA_HOURS, Low: 48, Medium: 24, High: 12 },
  },
  Other: {
    label: "Other",
    defaultDepartmentCode: "OPS",
    slaHours: { ...DEFAULT_SLA_HOURS },
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

// Allowed status transitions — every change-status call is validated against this map.
const STATUS_TRANSITIONS = {
  [STATUSES.NEW]: [STATUSES.ASSIGNED],
  [STATUSES.ASSIGNED]: [STATUSES.IN_PROGRESS, STATUSES.RESOLVED],
  [STATUSES.IN_PROGRESS]: [STATUSES.RESOLVED],
  [STATUSES.RESOLVED]: [STATUSES.REOPENED, STATUSES.CLOSED],
  [STATUSES.REOPENED]: [STATUSES.ASSIGNED, STATUSES.IN_PROGRESS],
  [STATUSES.CLOSED]: [],
};

const getCategoryConfig = (category) => CATEGORIES[category] || CATEGORIES.Other;

const getPrioritySlaHours = (category, priority) => {
  const config = getCategoryConfig(category);
  return config.slaHours[priority] || DEFAULT_SLA_HOURS[priority] || DEFAULT_SLA_HOURS.Medium;
};

/** slaDueDate = createdAt + SLA hours for category + priority */
const computeSlaDueDate = (category, priority, from = new Date()) =>
  new Date(from.getTime() + getPrioritySlaHours(category, priority) * 60 * 60 * 1000).toISOString();

const canTransitionStatus = (from, to) =>
  Array.isArray(STATUS_TRANSITIONS[from]) && STATUS_TRANSITIONS[from].includes(to);

const isOverdue = (complaint, now = new Date()) =>
  Boolean(
    complaint.slaDueDate &&
      OPEN_STATUSES.includes(complaint.status) &&
      new Date(complaint.slaDueDate).getTime() < now.getTime()
  );

module.exports = {
  PRIORITIES,
  STATUSES,
  OPEN_STATUSES,
  CATEGORIES,
  CATEGORY_KEYS,
  STATUS_TRANSITIONS,
  getCategoryConfig,
  getPrioritySlaHours,
  computeSlaDueDate,
  canTransitionStatus,
  isOverdue,
};