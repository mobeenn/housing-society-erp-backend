/**
 * Legacy permission strings retained only for seed compatibility and the
 * one-time migration into backend/data/db.json's dynamic RBAC registry.
 * Runtime authorization does not read this file; it uses rbacModules and
 * roleModuleAccess through src/modules/rbac/service.js.
 */

const PERMISSIONS = {
  // ── Members module ─────────────────────────────────────────────
  MEMBERS_VIEW: "members:view",
  MEMBERS_CREATE: "members:create",
  MEMBERS_EDIT: "members:edit",
  MEMBERS_DELETE: "members:delete",
  MEMBERS_APPROVE: "members:approve",

  // ── Plots / Units module ───────────────────────────────────────
  PLOTS_VIEW: "plots:view",
  PLOTS_CREATE: "plots:create",
  PLOTS_EDIT: "plots:edit",
  PLOTS_DELETE: "plots:delete",
  PLOTS_ASSIGN: "plots:assign",

  // ── Bookings & installments module ────────────────────────────
  BOOKINGS_VIEW: "bookings:view",
  BOOKINGS_CREATE: "bookings:create",
  BOOKINGS_EDIT: "bookings:edit",
  BOOKINGS_APPROVE: "bookings:approve",

  // ── Documents module ──────────────────────────────────────────
  DOCUMENTS_VIEW: "documents:view",
  DOCUMENTS_CREATE: "documents:create",
  DOCUMENTS_VERIFY: "documents:verify",

  // ── Invoicing module ───────────────────────────────────────────
  INVOICES_VIEW: "invoices:view",
  INVOICES_CREATE: "invoices:create",
  INVOICES_EDIT: "invoices:edit",
  INVOICES_DELETE: "invoices:delete",
  INVOICES_APPROVE: "invoices:approve",

  // ── Recovery module ───────────────────────────────────────────
  RECOVERY_VIEW: "recovery:view",
  RECOVERY_CREATE: "recovery:create",
  RECOVERY_EDIT: "recovery:edit",
  RECOVERY_DELETE: "recovery:delete",
  RECOVERY_APPROVE: "recovery:approve",
  RECOVERY_EXPORT: "recovery:export",

  // ── Payments module ────────────────────────────────────────────
  PAYMENTS_VIEW: "payments:view",
  PAYMENTS_CREATE: "payments:create",
  PAYMENTS_EDIT: "payments:edit",
  PAYMENTS_DELETE: "payments:delete",
  PAYMENTS_APPROVE: "payments:approve",
  PAYMENTS_RECONCILE: "payments:reconcile",
  REFUNDS_VIEW: "refunds:view",
  REFUNDS_CREATE: "refunds:create",
  REFUNDS_APPROVE: "refunds:approve",
  REFUNDS_PAY: "refunds:pay",
  EXPENSES_VIEW: "expenses:view",
  EXPENSES_CREATE: "expenses:create",
  EXPENSES_APPROVE: "expenses:approve",
  EXPENSES_PAY: "expenses:pay",
  TRANSFERS_VIEW: "transfers:view",
  TRANSFERS_CREATE: "transfers:create",
  TRANSFERS_VERIFY: "transfers:verify",
  TRANSFERS_APPROVE: "transfers:approve",
  TRANSFERS_COMPLETE: "transfers:complete",
  TRANSFERS_OVERRIDE_DUES: "transfers:override_dues",
  NOCS_VIEW: "nocs:view",
  NOCS_CREATE: "nocs:create",
  NOCS_VERIFY: "nocs:verify",
  NOCS_PAY: "nocs:pay",
  NOCS_APPROVE: "nocs:approve",
  NOCS_ISSUE: "nocs:issue",
  POSSESSION_VIEW: "possession:view",
  POSSESSION_CREATE: "possession:create",
  POSSESSION_VERIFY: "possession:verify",
  POSSESSION_PAY: "possession:pay",
  POSSESSION_APPROVE: "possession:approve",
  POSSESSION_ISSUE: "possession:issue",
  CONSTRUCTION_VIEW: "construction:view",
  CONSTRUCTION_CREATE: "construction:create",
  CONSTRUCTION_REVIEW: "construction:review",
  CONSTRUCTION_INSPECT: "construction:inspect",
  CONSTRUCTION_APPROVE: "construction:approve",

  // ── Complaints module ──────────────────────────────────────────
  COMPLAINTS_VIEW: "complaints:view",
  COMPLAINTS_CREATE: "complaints:create",
  COMPLAINTS_EDIT: "complaints:edit",
  COMPLAINTS_DELETE: "complaints:delete",
  COMPLAINTS_ASSIGN: "complaints:assign",
  COMPLAINTS_RESOLVE: "complaints:resolve",

  // ── Maintenance module ─────────────────────────────────────────
  MAINTENANCE_VIEW: "maintenance:view",
  MAINTENANCE_CREATE: "maintenance:create",
  MAINTENANCE_EDIT: "maintenance:edit",
  MAINTENANCE_DELETE: "maintenance:delete",
  MAINTENANCE_ASSIGN: "maintenance:assign",

  // ── Visitors module ────────────────────────────────────────────
  VISITORS_VIEW: "visitors:view",
  VISITORS_CREATE: "visitors:create",
  VISITORS_APPROVE: "visitors:approve",

  // ── Security Staff & Roster module ─────────────────────────────
  SECURITY_VIEW: "security:view",
  SECURITY_CREATE: "security:create",
  SECURITY_EDIT: "security:edit",
  SECURITY_MANAGE: "security:manage",

  // ── Vehicles module ────────────────────────────────────────────
  VEHICLES_VIEW: "vehicles:view",
  VEHICLES_CREATE: "vehicles:create",
  VEHICLES_EDIT: "vehicles:edit",
  VEHICLES_DELETE: "vehicles:delete",
  VEHICLES_MANAGE: "vehicles:manage",

  // ── Assets module ──────────────────────────────────────────────
  ASSETS_VIEW: "assets:view",
  ASSETS_CREATE: "assets:create",
  ASSETS_EDIT: "assets:edit",
  ASSETS_DELETE: "assets:delete",

  // ── Staff / HR module ──────────────────────────────────────────
  STAFF_VIEW: "staff:view",
  STAFF_CREATE: "staff:create",
  STAFF_EDIT: "staff:edit",
  STAFF_DELETE: "staff:delete",
  STAFF_MANAGE_PAYROLL: "staff:manage_payroll",

  // ── HR Payroll module ──────────────────────────────────────────
  HR_PAYROLL_VIEW: "hr-payroll:view",
  HR_PAYROLL_CREATE: "hr-payroll:create",
  HR_PAYROLL_EDIT: "hr-payroll:edit",
  HR_PAYROLL_APPROVE: "hr-payroll:approve",
  HR_PAYROLL_EXPORT: "hr-payroll:export",

  // ── Plot lifecycle / front desk modules ───────────────────────
  PLOT_MERGE_VIEW: "plot-merge:view",
  PLOT_MERGE_CREATE: "plot-merge:create",
  PLOT_MERGE_EXPORT: "plot-merge:export",
  BUYBACK_VIEW: "buyback:view",
  BUYBACK_CREATE: "buyback:create",
  BUYBACK_EXPORT: "buyback:export",
  REGISTRY_VIEW: "registry:view",
  REGISTRY_CREATE: "registry:create",
  REGISTRY_EDIT: "registry:edit",
  APPOINTMENTS_VIEW: "appointments:view",
  APPOINTMENTS_CREATE: "appointments:create",
  APPOINTMENTS_EDIT: "appointments:edit",

  // ── Inventory / Store module ───────────────────────────────────
  INVENTORY_VIEW: "inventory:view",
  INVENTORY_CREATE: "inventory:create",
  INVENTORY_EDIT: "inventory:edit",
  INVENTORY_DELETE: "inventory:delete",

  // ── Procurement module ─────────────────────────────────────────
  PROCUREMENT_VIEW: "procurement:view",
  PROCUREMENT_CREATE: "procurement:create",
  PROCUREMENT_EDIT: "procurement:edit",
  PROCUREMENT_APPROVE: "procurement:approve",

  // ── Reports & Analytics ────────────────────────────────────────
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",
  REPORTS_FINANCIAL: "reports:financial",

  // ── Communication & dashboards ────────────────────────────────
  NOTICES_VIEW: "notices:view",
  NOTICES_CREATE: "notices:create",
  NOTICES_MANAGE: "notices:manage",
  DASHBOARDS_VIEW: "dashboards:view",

  // ── Settings & Administration ──────────────────────────────────
  SETTINGS_VIEW: "settings:view",
  SETTINGS_MANAGE: "settings:manage",
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  ROLES_MANAGE: "roles:manage",

  // ── System-level ───────────────────────────────────────────────
  SYSTEM_ADMIN: "system:admin",
  AUDIT_VIEW: "audit:view",
};

// ── All permissions as array ────────────────────────────────────
const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// ── Grouped permissions for frontend display ────────────────────
const PERMISSION_GROUPS = [
  {
    module: "Members",
    permissions: [
      { key: "members:view", label: "View Members" },
      { key: "members:create", label: "Create Members" },
      { key: "members:edit", label: "Edit Members" },
      { key: "members:delete", label: "Delete Members" },
      { key: "members:approve", label: "Approve Members" },
    ],
  },
  {
    module: "Plots / Units",
    permissions: [
      { key: "plots:view", label: "View Plots" },
      { key: "plots:create", label: "Create Plots" },
      { key: "plots:edit", label: "Edit Plots" },
      { key: "plots:delete", label: "Delete Plots" },
      { key: "plots:assign", label: "Assign Plots" },
    ],
  },
  {
    module: "Invoicing",
    permissions: [
      { key: "invoices:view", label: "View Invoices" },
      { key: "invoices:create", label: "Create Invoices" },
      { key: "invoices:edit", label: "Edit Invoices" },
      { key: "invoices:delete", label: "Delete Invoices" },
      { key: "invoices:approve", label: "Approve Invoices" },
    ],
  },
  {
    module: "Recovery",
    permissions: [
      { key: "recovery:view", label: "View Recovery" },
      { key: "recovery:create", label: "Assign Recovery Plots" },
      { key: "recovery:edit", label: "Manage Recovery Calls" },
      { key: "recovery:delete", label: "Delete Recovery Records" },
      { key: "recovery:approve", label: "Approve Recovery Actions" },
      { key: "recovery:export", label: "Export Recovery Reports" },
    ],
  },
  {
    module: "Bookings",
    permissions: [
      { key: "bookings:view", label: "View Bookings" },
      { key: "bookings:create", label: "Create Bookings" },
      { key: "bookings:edit", label: "Edit Bookings" },
      { key: "bookings:approve", label: "Approve Bookings" },
    ],
  },
  {
    module: "Documents",
    permissions: [
      { key: "documents:view", label: "View Documents" },
      { key: "documents:create", label: "Upload Documents" },
      { key: "documents:verify", label: "Verify Documents" },
    ],
  },
  {
    module: "Payments",
    permissions: [
      { key: "payments:view", label: "View Payments" },
      { key: "payments:create", label: "Record Payments" },
      { key: "payments:edit", label: "Edit Payments" },
      { key: "payments:delete", label: "Delete Payments" },
      { key: "payments:approve", label: "Approve Payments" },
      { key: "payments:reconcile", label: "Reconcile Payments" },
      { key: "refunds:view", label: "View Refunds" },
      { key: "refunds:create", label: "Create Refunds" },
      { key: "refunds:approve", label: "Approve Refunds" },
      { key: "refunds:pay", label: "Pay Refunds" },
      { key: "expenses:view", label: "View Expenses" },
      { key: "expenses:create", label: "Create Expenses" },
      { key: "expenses:approve", label: "Approve Expenses" },
      { key: "expenses:pay", label: "Pay Expenses" },
      { key: "transfers:view", label: "View Transfers" },
      { key: "transfers:create", label: "Create Transfers" },
      { key: "transfers:verify", label: "Verify Transfers" },
      { key: "transfers:approve", label: "Approve Transfers" },
      { key: "transfers:complete", label: "Complete Transfers" },
      { key: "transfers:override_dues", label: "Override Transfer Dues" },
      { key: "nocs:view", label: "View NOCs" },
      { key: "nocs:create", label: "Create NOCs" },
      { key: "nocs:verify", label: "Verify NOCs" },
      { key: "nocs:pay", label: "Pay NOC Fees" },
      { key: "nocs:approve", label: "Approve NOCs" },
      { key: "nocs:issue", label: "Issue NOCs" },
      { key: "possession:view", label: "View Possession" },
      { key: "possession:create", label: "Create Possession" },
      { key: "possession:verify", label: "Verify Possession" },
      { key: "possession:pay", label: "Pay Possession Charges" },
      { key: "possession:approve", label: "Approve Possession" },
      { key: "possession:issue", label: "Issue Possession" },
      { key: "construction:view", label: "View Construction" },
      { key: "construction:create", label: "Create Construction Applications" },
      { key: "construction:review", label: "Review Construction" },
      { key: "construction:inspect", label: "Inspect Construction" },
      { key: "construction:approve", label: "Approve Construction" },
    ],
  },
  {
    module: "Complaints",
    permissions: [
      { key: "complaints:view", label: "View Complaints" },
      { key: "complaints:create", label: "Create Complaints" },
      { key: "complaints:edit", label: "Edit Complaints" },
      { key: "complaints:delete", label: "Delete Complaints" },
      { key: "complaints:assign", label: "Assign Complaints" },
      { key: "complaints:resolve", label: "Resolve Complaints" },
    ],
  },
  {
    module: "Maintenance",
    permissions: [
      { key: "maintenance:view", label: "View Work Orders" },
      { key: "maintenance:create", label: "Create Work Orders" },
      { key: "maintenance:edit", label: "Edit Work Orders" },
      { key: "maintenance:delete", label: "Delete Work Orders" },
      { key: "maintenance:assign", label: "Assign Work Orders" },
    ],
  },
  {
    module: "Assets",
    permissions: [
      { key: "assets:view", label: "View Assets" },
      { key: "assets:create", label: "Register Assets" },
      { key: "assets:edit", label: "Edit Assets" },
      { key: "assets:delete", label: "Delete Assets" },
    ],
  },
  {
    module: "Security & Roster",
    permissions: [
      { key: "security:view", label: "View Guards & Roster" },
      { key: "security:create", label: "Add Guards" },
      { key: "security:edit", label: "Edit Guards" },
      { key: "security:manage", label: "Manage Roster & Attendance" },
    ],
  },
  {
    module: "Vehicles",
    permissions: [
      { key: "vehicles:view", label: "View Vehicles" },
      { key: "vehicles:create", label: "Register Vehicles" },
      { key: "vehicles:edit", label: "Edit Vehicles" },
      { key: "vehicles:delete", label: "Delete Vehicles" },
      { key: "vehicles:manage", label: "Manage Stickers & Status" },
    ],
  },
  {
    module: "Visitors",
    permissions: [
      { key: "visitors:view", label: "View Visitors" },
      { key: "visitors:create", label: "Register Visitors" },
      { key: "visitors:approve", label: "Approve Visitor Access" },
    ],
  },
  {
    module: "HR & Staff",
    permissions: [
      { key: "staff:view", label: "View Staff" },
      { key: "staff:create", label: "Create Staff Records" },
      { key: "staff:edit", label: "Edit Staff Records" },
      { key: "staff:delete", label: "Delete Staff Records" },
      { key: "staff:manage_payroll", label: "Manage Payroll" },
    ],
  },
  {
    module: "HR Payroll",
    permissions: [
      { key: "hr-payroll:view", label: "View Payroll" },
      { key: "hr-payroll:create", label: "Generate Payroll / Disburse Loans" },
      { key: "hr-payroll:edit", label: "Edit Payroll / Close Loans" },
      { key: "hr-payroll:approve", label: "Approve Payroll" },
      { key: "hr-payroll:export", label: "Export Payroll Reports" },
    ],
  },
  {
    module: "Plot Merge",
    permissions: [
      { key: "plot-merge:view", label: "View Plot Merges" },
      { key: "plot-merge:create", label: "Execute Plot Merge" },
      { key: "plot-merge:export", label: "Export Plot Merge Documents" },
    ],
  },
  {
    module: "Buyback / Cancel",
    permissions: [
      { key: "buyback:view", label: "View Buyback Records" },
      { key: "buyback:create", label: "Execute Buyback / Cancel" },
      { key: "buyback:export", label: "Export Buyback Documents" },
    ],
  },
  {
    module: "Registry",
    permissions: [
      { key: "registry:view", label: "View Registry Batches" },
      { key: "registry:create", label: "Create Registry Batches" },
      { key: "registry:edit", label: "Complete Registry Batches" },
    ],
  },
  {
    module: "Appointments",
    permissions: [
      { key: "appointments:view", label: "View Appointments" },
      { key: "appointments:create", label: "Create Walk-in Appointments" },
      { key: "appointments:edit", label: "Check In / Check Out" },
    ],
  },
  {
    module: "Inventory",
    permissions: [
      { key: "inventory:view", label: "View Inventory" },
      { key: "inventory:create", label: "Create Inventory Items" },
      { key: "inventory:edit", label: "Edit Inventory" },
      { key: "inventory:delete", label: "Delete Inventory" },
    ],
  },
  {
    module: "Procurement",
    permissions: [
      { key: "procurement:view", label: "View Procurement" },
      { key: "procurement:create", label: "Create Procurement Requests" },
      { key: "procurement:edit", label: "Edit Procurement" },
      { key: "procurement:approve", label: "Approve Procurement" },
    ],
  },
  {
    module: "Reports & Analytics",
    permissions: [
      { key: "reports:view", label: "View Reports" },
      { key: "reports:export", label: "Export Reports" },
      { key: "reports:financial", label: "View Financial Reports" },
    ],
  },
  {
    module: "Communication & Dashboards",
    permissions: [
      { key: "notices:view", label: "View Notices" },
      { key: "notices:create", label: "Create & Publish Notices" },
      { key: "notices:manage", label: "Manage All Notices" },
      { key: "dashboards:view", label: "View Role Dashboards" },
    ],
  },
  {
    module: "Settings & Administration",
    permissions: [
      { key: "settings:view", label: "View Settings" },
      { key: "settings:manage", label: "Manage Settings" },
      { key: "users:view", label: "View Users" },
      { key: "users:manage", label: "Manage Users" },
      { key: "roles:manage", label: "Manage Roles" },
      { key: "audit:view", label: "View Audit Logs" },
    ],
  },
  {
    module: "System",
    permissions: [
      { key: "system:admin", label: "System Administrator (All Access)" },
    ],
  },
];

module.exports = { PERMISSIONS, ALL_PERMISSIONS, PERMISSION_GROUPS };
