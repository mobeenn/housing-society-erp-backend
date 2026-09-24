const { connectDB, db } = require("../config/db");
const Module = require("../modules/rbac/module.model");
const RbacService = require("../modules/rbac/service");

const MODULES = [
  ["dashboards", "Dashboards", "Role-specific operational dashboards", "Overview", "LayoutDashboard", 10, "/dashboard"],
  ["members", "Members", "Member registration and records", "Members & Property", "Users", 20, "/members"],
  ["plots", "Plots / Units", "Plot inventory and ownership", "Members & Property", "Map", 30, "/plots"],
  ["bookings", "Bookings", "Plot booking and approvals", "Members & Property", "ClipboardCheck", 40, "/bookings"],
  ["installments", "Installments", "Installment plans and balances", "Finance", "CalendarCheck", 50, "/payments", false],
  ["transfers", "Transfers", "Ownership transfer workflows", "Members & Property", "ArrowRightLeft", 60, "/transfers"],
  ["possession", "Possession", "Possession applications and handover", "Members & Property", "Hand", 70, "/possession"],
  ["nocs", "NOCs", "No-objection certificates", "Members & Property", "FileCheck", 80, "/nocs"],
  ["construction", "Construction", "Construction approvals and inspections", "Members & Property", "HardHat", 90, "/construction"],
  ["payments", "Payments", "Payments, receipts and allocation", "Finance", "Wallet", 100, "/payments"],
  ["refunds", "Refunds", "Refund requests and processing", "Finance", "Undo2", 110, "/refunds"],
  ["expenses", "Expenses", "Society expenses and approvals", "Finance", "Receipt", 120, "/expenses"],
  ["reports", "Reports", "Cross-module reports and exports", "Finance", "BarChart3", 130, "/reports"],
  ["complaints", "Complaints", "Complaint intake and SLA tracking", "Operations", "MessageSquareWarning", 140, "/complaints"],
  ["maintenance", "Maintenance", "Work orders and maintenance", "Operations", "Wrench", 150, "/maintenance"],
  ["assets", "Assets", "Society asset registry", "Operations", "Package", 160, "/assets"],
  ["procurement", "Procurement", "Vendors, quotations and purchase orders", "Operations", "ShoppingCart", 170, "/procurement/vendors"],
  ["inventory", "Inventory", "Stock levels and low-stock alerts", "Operations", "Boxes", 180, "/inventory"],
  ["security-guards", "Guard Roster", "Security staff and duty roster", "Security", "Shield", 190, "/security/guards"],
  ["security-vehicles", "Vehicles", "Vehicle registry and access stickers", "Security", "Car", 200, "/security/vehicles"],
  ["visitors", "Visitors", "Visitor entry, passes and blacklist", "Security", "UserCheck", 210, "/security/visitors/entry"],
  ["hr", "HR & Staff", "Employees, attendance and leave", "Human Resources", "UserCog", 220, "/hr/employees"],
  ["notices", "Notice Board", "Society announcements", "Communication", "Bell", 230, "/notices"],
  ["settings", "Society Settings", "Society configuration and master data", "Administration", "Settings", 240, "/settings/profile"],
  ["users-roles", "Users & Roles", "User accounts, roles and access control", "Administration", "ShieldCheck", 250, "/admin/users"],
  ["audit", "Audit Logs", "System audit trail", "Administration", "Activity", 260, "/settings/audit-logs"],
  ["documents", "Documents", "Member and entity documents", "Members & Property", "FolderOpen", 270, "/documents", false],
  ["invoices", "Invoices", "Searchable registry of generated society documents", "Finance", "FileText", 300, "/invoices", true],
  ["dealers", "Dealers", "Future dealer management module", "Future Modules", "Handshake", 310, "/dealers", false],
  ["recovery", "Recovery", "Overdue installment recovery assignments and calls", "Finance", "SearchCheck", 320, "/recovery", true],
  ["finance-gl", "Finance GL", "Future general ledger module", "Finance", "BookOpen", 330, "/finance-gl", false],
  ["hr-payroll", "HR Payroll", "Payroll, employee loans and statutory configuration", "Human Resources", "BadgeDollarSign", 340, "/hr/payroll", true],
  ["appointments", "Appointments", "Front-desk business visitor tokens and meeting queue", "Front Desk", "CalendarClock", 350, "/appointments", true],
  ["plot-merge", "Plot Merge", "Irreversible plot merge workflow", "Members & Property", "Combine", 360, "/plot-merge", true],
  ["buyback", "Buyback / Cancel", "Irreversible booking buyback and cancellation workflow", "Finance", "RefreshCcw", 370, "/buyback", true],
  ["registry", "Registry", "Physical paperwork registry batch tracking", "Administration", "Library", 380, "/registry", true],
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
