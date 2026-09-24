/**
 * Dynamic RBAC action contract.
 *
 * Module definitions and role access are persisted in the database. The
 * legacy string constants are re-exported only so old development seed scripts
 * can migrate existing role documents; runtime authorization never reads them.
 */
const ACTIONS = ["view", "create", "edit", "delete", "approve", "reject", "cancel", "print", "export", "refund"];

const MODULE_ACTIONS = Object.fromEntries([
  "members", "plots", "bookings", "installments", "payments", "refunds", "expenses",
  "transfers", "nocs", "possession", "construction", "complaints", "maintenance",
  "assets", "security-guards", "security-vehicles", "visitors", "hr", "procurement",
  "inventory", "notices", "dashboards", "reports", "settings", "users-roles", "audit",
  "documents", "invoices", "dealers", "recovery", "finance-gl", "hr-payroll",
  "appointments", "plot-merge", "buyback", "registry",
].map((key) => [key, ACTIONS]));

const legacy = require("./legacyPermissions");

module.exports = {
  ACTIONS,
  MODULE_ACTIONS,
  // Compatibility exports for seed scripts only.
  ...legacy,
};
