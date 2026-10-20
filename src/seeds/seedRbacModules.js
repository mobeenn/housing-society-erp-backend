const { connectDB, db } = require("../config/db");
const Module = require("../modules/rbac/module.model");
const RbacService = require("../modules/rbac/service");

/**
 * P3-1 sidebar regroup. Tuple:
 * [key, label, description, group, icon, sortOrder, route, showInSidebar=true]
 */
const MODULES = [
  // Home
  ["dashboards", "Dashboard", "Role-specific operational dashboards", "Home", "LayoutDashboard", 10, "/dashboard"],

  // People & Property
  ["members", "Members", "Member registration and records", "People & Property", "Users", 20, "/members"],
  ["plots", "Plots / Units", "Plot inventory and ownership", "People & Property", "Map", 30, "/plots"],
  ["bookings", "Bookings", "Plot booking and approvals", "People & Property", "ClipboardCheck", 40, "/bookings"],
  ["documents", "Documents", "Member and entity documents", "People & Property", "FolderOpen", 45, "/documents", false],

  // Finance
  ["payments", "Payments", "Payments, receipts and allocation", "Finance", "Wallet", 50, "/payments"],
  ["installments", "Installments", "Installment plans and balances", "Finance", "CalendarCheck", 55, "/payments", false],
  ["refunds", "Refunds", "Refund requests and processing", "Finance", "Undo2", 60, "/refunds"],
  ["expenses", "Expenses", "Society expenses and approvals", "Finance", "Receipt", 70, "/expenses"],
  ["recovery", "Recovery", "Overdue installment recovery assignments and calls", "Finance", "SearchCheck", 80, "/recovery", true],
  ["reports", "Reports", "Cross-module reports and exports", "Finance", "BarChart3", 90, "/reports"],
  ["invoices", "Receipts & Certificates", "Searchable registry of generated society documents", "Finance", "FileText", 100, "/invoices", true],
  ["finance-gl", "Finance GL", "Internal general ledger module", "Finance", "BookOpen", 105, "/finance-gl", false],
  ["buyback", "Buyback / Cancel", "Irreversible booking buyback and cancellation (via booking detail)", "Finance", "RefreshCcw", 110, "/buyback", false],

  // Property Services
  ["transfers", "Transfers", "Ownership transfer workflows", "Property Services", "ArrowRightLeft", 120, "/property-services?type=transfer"],
  ["nocs", "NOCs", "No-objection certificates", "Property Services", "FileCheck", 130, "/property-services?type=noc"],
  ["possession", "Possession", "Possession applications and handover", "Property Services", "Hand", 140, "/property-services?type=possession"],
  ["construction", "Construction", "Construction approvals and inspections", "Property Services", "HardHat", 150, "/property-services?type=construction"],
  ["registry", "Registry", "Physical paperwork registry batch tracking", "Property Services", "Library", 160, "/property-services?type=registry"],
  ["plot-merge", "Plot Merge", "Irreversible plot merge (via plot detail)", "Property Services", "Combine", 170, "/plot-merge", false],

  // Operations
  ["complaints", "Complaints", "Complaint intake and SLA tracking", "Operations", "MessageSquareWarning", 180, "/complaints"],
  ["maintenance", "Maintenance", "Work orders and maintenance", "Operations", "Wrench", 190, "/maintenance"],
  ["assets", "Assets", "Society asset registry", "Operations", "Package", 200, "/assets"],
  ["inventory", "Inventory", "Stock levels and low-stock alerts", "Operations", "Boxes", 210, "/inventory"],
  ["procurement", "Purchasing", "Vendors, quotations and purchase orders", "Operations", "ShoppingCart", 220, "/procurement/vendors"],

  // Security & Front Desk
  ["visitors", "Visitors", "Gate entries and office appointments", "Security & Front Desk", "UserCheck", 230, "/security/visitors"],
  ["security-vehicles", "Vehicles", "Vehicle registry and access stickers", "Security & Front Desk", "Car", 240, "/security/vehicles"],
  ["security-guards", "Guards", "Security staff and duty roster", "Security & Front Desk", "Shield", 250, "/security/guards"],
  ["appointments", "Office Appointments", "Front-desk business visitor tokens and meeting queue", "Security & Front Desk", "CalendarClock", 260, "/security/visitors/appointments", false],

  // People (HR)
  ["hr", "HR", "Employees, attendance and leave", "People (HR)", "UserCog", 270, "/hr/employees"],
  ["hr-payroll", "Payroll", "Payroll, employee loans and statutory configuration", "People (HR)", "BadgeDollarSign", 280, "/hr/payroll", false],

  // Admin
  ["notices", "Notices", "Society announcements", "Admin", "Bell", 290, "/notices"],
  ["users-roles", "Users & Roles", "User accounts, roles and access control", "Admin", "ShieldCheck", 300, "/admin/users"],
  ["settings", "Settings", "Society configuration and master data", "Admin", "Settings", 310, "/settings/profile"],
  ["audit", "Audit Log", "System audit trail", "Admin", "Activity", 320, "/settings/audit-logs"],

  // Hidden placeholders
  ["dealers", "Dealers", "Future dealer management module", "Admin", "Handshake", 990, "/dealers", false],
];

async function seedRbac() {
  await connectDB();
  for (const [key, label, description, group, icon, sortOrder, route, showInSidebar = true] of MODULES) {
    const existing = await Module.findByKey(key);
    const data = { key, label, description, group, icon, sortOrder, route, showInSidebar, isActive: true };
    if (existing) await Module.update(key, data);
    else await Module.create(data);
  }
  const migration = await RbacService.migrateLegacyAccess({ force: process.argv.includes("--force") });
  await db.save();
  console.log(`\n🔐 RBAC registry seeded: ${MODULES.length} modules.`);
  console.log(`   Migration: ${migration.migrated ? "completed" : "already current"} (${migration.version}).\n`);
}

if (require.main === module) seedRbac().catch((error) => { console.error("RBAC seed failed:", error); process.exitCode = 1; });
module.exports = { MODULES, seedRbac };
