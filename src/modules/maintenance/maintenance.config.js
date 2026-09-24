/**
 * Maintenance module configuration (SRS Section 17)
 * - Asset types for the asset registry
 * - Work order statuses + allowed transitions
 * - Work order priorities
 */

const ASSET_TYPES = [
  "road",
  "light",
  "park",
  "water",
  "sewerage",
  "drainage",
  "building",
  "other",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const STATUSES = {
  OPEN: "Open",
  IN_PROGRESS: "InProgress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_LIST = Object.values(STATUSES);

// Allowed status transitions — every status change is validated against this map.
const STATUS_TRANSITIONS = {
  [STATUSES.OPEN]: [STATUSES.IN_PROGRESS, STATUSES.CANCELLED],
  [STATUSES.IN_PROGRESS]: [STATUSES.COMPLETED, STATUSES.CANCELLED],
  [STATUSES.COMPLETED]: [],
  [STATUSES.CANCELLED]: [],
};

const canTransitionStatus = (from, to) =>
  Array.isArray(STATUS_TRANSITIONS[from]) && STATUS_TRANSITIONS[from].includes(to);

/** Total cost of a work order (labor + materials cost). */
const totalCost = (workOrder) =>
  Number(workOrder?.laborCost || 0) + Number(workOrder?.materialCost || 0);

module.exports = {
  ASSET_TYPES,
  PRIORITIES,
  STATUSES,
  STATUS_LIST,
  STATUS_TRANSITIONS,
  canTransitionStatus,
  totalCost,
};