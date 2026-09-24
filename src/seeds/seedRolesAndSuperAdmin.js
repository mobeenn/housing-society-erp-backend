const bcrypt = require("bcryptjs");
const { connectDB } = require("../config/db");
const env = require("../config/env");
const Role = require("../modules/auth/role.model");
const User = require("../modules/auth/user.model");
const { PERMISSIONS } = require("../config/legacyPermissions");

/**
 * Seed default roles and Super Admin user.
 * Run with: npm run seed
 */

const DEFAULT_ROLES = [
  {
    name: "Super Admin",
    description: "Full system access — can manage everything including users and settings",
    permissions: [PERMISSIONS.SYSTEM_ADMIN], // Grants all permissions programmatically
    isSystemRole: true,
  },
  {
    name: "Society Admin",
    description: "Society-level admin — manages members, plots, finances, complaints",
    permissions: [
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.MEMBERS_CREATE,
      PERMISSIONS.MEMBERS_EDIT,
      PERMISSIONS.MEMBERS_APPROVE,
      PERMISSIONS.PLOTS_VIEW,
      PERMISSIONS.PLOTS_CREATE,
      PERMISSIONS.PLOTS_EDIT,
      PERMISSIONS.PLOTS_ASSIGN,
      PERMISSIONS.BOOKINGS_VIEW,
      PERMISSIONS.BOOKINGS_CREATE,
      PERMISSIONS.BOOKINGS_EDIT,
      PERMISSIONS.BOOKINGS_APPROVE,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_CREATE,
      PERMISSIONS.DOCUMENTS_VERIFY,
      PERMISSIONS.EXPENSES_VIEW,
      PERMISSIONS.EXPENSES_CREATE,
      PERMISSIONS.EXPENSES_APPROVE,
      PERMISSIONS.EXPENSES_PAY,
      PERMISSIONS.TRANSFERS_VIEW,
      PERMISSIONS.TRANSFERS_CREATE,
      PERMISSIONS.TRANSFERS_VERIFY,
      PERMISSIONS.TRANSFERS_APPROVE,
      PERMISSIONS.TRANSFERS_COMPLETE,
      PERMISSIONS.TRANSFERS_OVERRIDE_DUES,
      PERMISSIONS.NOCS_VIEW,
      PERMISSIONS.NOCS_CREATE,
      PERMISSIONS.NOCS_VERIFY,
      PERMISSIONS.NOCS_PAY,
      PERMISSIONS.NOCS_APPROVE,
      PERMISSIONS.NOCS_ISSUE,
      PERMISSIONS.POSSESSION_VIEW,
      PERMISSIONS.POSSESSION_CREATE,
      PERMISSIONS.POSSESSION_VERIFY,
      PERMISSIONS.POSSESSION_PAY,
      PERMISSIONS.POSSESSION_APPROVE,
      PERMISSIONS.POSSESSION_ISSUE,
      PERMISSIONS.CONSTRUCTION_VIEW,
      PERMISSIONS.CONSTRUCTION_CREATE,
      PERMISSIONS.CONSTRUCTION_REVIEW,
      PERMISSIONS.CONSTRUCTION_INSPECT,
      PERMISSIONS.CONSTRUCTION_APPROVE,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_CREATE,
      PERMISSIONS.REFUNDS_VIEW,
      PERMISSIONS.REFUNDS_CREATE,
      PERMISSIONS.REFUNDS_APPROVE,
      PERMISSIONS.REFUNDS_PAY,
      PERMISSIONS.INVOICES_VIEW,
      PERMISSIONS.INVOICES_CREATE,
      PERMISSIONS.INVOICES_EDIT,
      PERMISSIONS.INVOICES_APPROVE,
      PERMISSIONS.RECOVERY_VIEW,
      PERMISSIONS.RECOVERY_CREATE,
      PERMISSIONS.RECOVERY_EDIT,
      PERMISSIONS.RECOVERY_APPROVE,
      PERMISSIONS.RECOVERY_EXPORT,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_APPROVE,
      PERMISSIONS.COMPLAINTS_VIEW,
      PERMISSIONS.COMPLAINTS_EDIT,
      PERMISSIONS.COMPLAINTS_ASSIGN,
      PERMISSIONS.COMPLAINTS_RESOLVE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_MANAGE,
    ],
    isSystemRole: true,
  },
  {
    name: "Property Officer",
    description: "Manages plots, units, member registrations and assignments",
    permissions: [
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.MEMBERS_CREATE,
      PERMISSIONS.MEMBERS_EDIT,
      PERMISSIONS.PLOTS_VIEW,
      PERMISSIONS.PLOTS_CREATE,
      PERMISSIONS.PLOTS_EDIT,
      PERMISSIONS.PLOTS_ASSIGN,
      PERMISSIONS.BOOKINGS_VIEW,
      PERMISSIONS.BOOKINGS_CREATE,
      PERMISSIONS.BOOKINGS_EDIT,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_CREATE,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_CREATE,
      PERMISSIONS.REFUNDS_VIEW,
      PERMISSIONS.REFUNDS_CREATE,
      PERMISSIONS.RECOVERY_VIEW,
      PERMISSIONS.RECOVERY_EDIT,
      PERMISSIONS.RECOVERY_EXPORT,
      PERMISSIONS.REPORTS_VIEW,
    ],
    isSystemRole: true,
  },
  {
    name: "Finance Officer",
    description: "Handles invoicing, payments, reconciliation and financial reports",
    permissions: [
      PERMISSIONS.INVOICES_VIEW,
      PERMISSIONS.INVOICES_CREATE,
      PERMISSIONS.INVOICES_EDIT,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_CREATE,
      PERMISSIONS.PAYMENTS_EDIT,
      PERMISSIONS.PAYMENTS_APPROVE,
      PERMISSIONS.PAYMENTS_RECONCILE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.REPORTS_FINANCIAL,
      PERMISSIONS.RECOVERY_VIEW,
      PERMISSIONS.RECOVERY_CREATE,
      PERMISSIONS.RECOVERY_EDIT,
      PERMISSIONS.RECOVERY_APPROVE,
      PERMISSIONS.RECOVERY_EXPORT,
      PERMISSIONS.EXPENSES_VIEW,
      PERMISSIONS.EXPENSES_CREATE,
      PERMISSIONS.EXPENSES_APPROVE,
      PERMISSIONS.EXPENSES_PAY,
      PERMISSIONS.TRANSFERS_VIEW,
      PERMISSIONS.TRANSFERS_CREATE,
      PERMISSIONS.TRANSFERS_VERIFY,
      PERMISSIONS.TRANSFERS_COMPLETE,
      PERMISSIONS.NOCS_VIEW,
      PERMISSIONS.NOCS_CREATE,
      PERMISSIONS.NOCS_VERIFY,
      PERMISSIONS.NOCS_PAY,
      PERMISSIONS.POSSESSION_VIEW,
      PERMISSIONS.POSSESSION_CREATE,
      PERMISSIONS.POSSESSION_VERIFY,
      PERMISSIONS.POSSESSION_PAY,
      PERMISSIONS.CONSTRUCTION_VIEW,
      PERMISSIONS.CONSTRUCTION_CREATE,
      PERMISSIONS.CONSTRUCTION_INSPECT,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_CREATE,
      PERMISSIONS.REFUNDS_VIEW,
      PERMISSIONS.REFUNDS_APPROVE,
      PERMISSIONS.REFUNDS_PAY,
    ],
    isSystemRole: true,
  },
  {
    name: "Operations Manager",
    description: "Oversees complaints, maintenance and day-to-day operations",
    permissions: [
      PERMISSIONS.COMPLAINTS_VIEW,
      PERMISSIONS.COMPLAINTS_EDIT,
      PERMISSIONS.COMPLAINTS_ASSIGN,
      PERMISSIONS.COMPLAINTS_RESOLVE,
      PERMISSIONS.MAINTENANCE_VIEW,
      PERMISSIONS.MAINTENANCE_CREATE,
      PERMISSIONS.MAINTENANCE_EDIT,
      PERMISSIONS.MAINTENANCE_ASSIGN,
      PERMISSIONS.RECOVERY_VIEW,
      PERMISSIONS.RECOVERY_EDIT,
      PERMISSIONS.RECOVERY_EXPORT,
      PERMISSIONS.REPORTS_VIEW,
    ],
    isSystemRole: true,
  },
  {
    name: "Security Manager",
    description: "Manages visitor logs, security staff and access control",
    permissions: [
      PERMISSIONS.VISITORS_VIEW,
      PERMISSIONS.VISITORS_CREATE,
      PERMISSIONS.VISITORS_APPROVE,
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_CREATE,
      PERMISSIONS.STAFF_EDIT,
      PERMISSIONS.REPORTS_VIEW,
    ],
    isSystemRole: true,
  },
  {
    name: "Security Guard",
    description: "Records visitor entries and exits",
    permissions: [PERMISSIONS.VISITORS_VIEW, PERMISSIONS.VISITORS_CREATE],
    isSystemRole: true,
  },
  {
    name: "HR Officer",
    description: "Manages staff records, payroll and attendance",
    permissions: [
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_CREATE,
      PERMISSIONS.STAFF_EDIT,
      PERMISSIONS.STAFF_MANAGE_PAYROLL,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
    ],
    isSystemRole: true,
  },
  {
    name: "Store Manager",
    description: "Manages inventory, stock and asset tracking",
    permissions: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_CREATE,
      PERMISSIONS.INVENTORY_EDIT,
      PERMISSIONS.ASSETS_VIEW,
      PERMISSIONS.ASSETS_CREATE,
      PERMISSIONS.ASSETS_EDIT,
      PERMISSIONS.REPORTS_VIEW,
    ],
    isSystemRole: true,
  },
  {
    name: "Procurement Officer",
    description: "Creates purchase orders and manages vendor procurement",
    permissions: [
      PERMISSIONS.PROCUREMENT_VIEW,
      PERMISSIONS.PROCUREMENT_CREATE,
      PERMISSIONS.PROCUREMENT_EDIT,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.REPORTS_VIEW,
    ],
    isSystemRole: true,
  },
  {
    name: "Receptionist",
    description: "Front-desk operations — visitor logging and basic queries",
    permissions: [
      PERMISSIONS.VISITORS_VIEW,
      PERMISSIONS.VISITORS_CREATE,
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.COMPLAINTS_VIEW,
      PERMISSIONS.COMPLAINTS_CREATE,
    ],
    isSystemRole: true,
  },
  {
    name: "Auditor",
    description: "Read-only access to financial records and audit logs",
    permissions: [
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.PLOTS_VIEW,
      PERMISSIONS.INVOICES_VIEW,
      PERMISSIONS.RECOVERY_VIEW,
      PERMISSIONS.RECOVERY_EXPORT,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.REPORTS_FINANCIAL,
      PERMISSIONS.AUDIT_VIEW,
    ],
    isSystemRole: true,
  },
];

async function seed() {
  try {
    await connectDB();

    console.log("\n🌱 Seeding roles and super admin...\n");

    // ── 1. Create default roles ────────────────────────────────
    for (const roleData of DEFAULT_ROLES) {
      const existing = await Role.findOne({ name: roleData.name });
      if (existing) {
        console.log(`   ⏭️  Role "${roleData.name}" already exists, skipping.`);
      } else {
        const permissions = [...new Set([
          ...(roleData.permissions || []).filter(Boolean),
          PERMISSIONS.NOTICES_VIEW,
          PERMISSIONS.DASHBOARDS_VIEW,
          PERMISSIONS.REPORTS_VIEW,
        ])];
        await Role.create({ ...roleData, permissions });
        console.log(`   ✅ Created role: ${roleData.name}`);
      }
    }

    // ── 2. Create Super Admin user ─────────────────────────────
    const superAdminEmail = env.SUPERADMIN_EMAIL || "admin@housing-society.local";
    const superAdminPassword = env.SUPERADMIN_PASSWORD || "SuperAdmin@123";

    const existingAdmin = await User.findOne({ email: superAdminEmail });

    if (existingAdmin) {
      console.log(`\n   ⏭️  Super Admin "${superAdminEmail}" already exists, skipping.\n`);
    } else {
      const superAdminRole = await Role.findOne({ name: "Super Admin" });
      if (!superAdminRole) {
        throw new Error("Super Admin role not found — cannot create user");
      }

      const passwordHash = await bcrypt.hash(superAdminPassword, 10);

      await User.create({
        name: "Super Admin",
        email: superAdminEmail,
        passwordHash,
        roles: [superAdminRole._id],
        isActive: true,
        mustResetPassword: false,
      });

      console.log(`\n   ✅ Created Super Admin user:`);
      console.log(`      Email: ${superAdminEmail}`);
      console.log(`      Password: ${superAdminPassword}`);
      console.log(`      ⚠️  Change the password after first login!\n`);
    }

    console.log("🎉 Seed completed successfully.\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seed failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

seed();
