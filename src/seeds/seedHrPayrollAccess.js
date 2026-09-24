const { connectDB } = require("../config/db");
const Role = require("../modules/auth/role.model");
const RbacService = require("../modules/rbac/service");
const { PERMISSIONS } = require("../config/legacyPermissions");

const ROLE_ACCESS = {
  "Society Admin": [
    PERMISSIONS.HR_PAYROLL_VIEW,
    PERMISSIONS.HR_PAYROLL_CREATE,
    PERMISSIONS.HR_PAYROLL_EDIT,
    PERMISSIONS.HR_PAYROLL_APPROVE,
    PERMISSIONS.HR_PAYROLL_EXPORT,
  ],
  "HR Officer": [
    PERMISSIONS.HR_PAYROLL_VIEW,
    PERMISSIONS.HR_PAYROLL_CREATE,
    PERMISSIONS.HR_PAYROLL_EDIT,
    PERMISSIONS.HR_PAYROLL_APPROVE,
    PERMISSIONS.HR_PAYROLL_EXPORT,
  ],
  "Finance Officer": [
    PERMISSIONS.HR_PAYROLL_VIEW,
    PERMISSIONS.HR_PAYROLL_CREATE,
    PERMISSIONS.HR_PAYROLL_EDIT,
    PERMISSIONS.HR_PAYROLL_APPROVE,
    PERMISSIONS.HR_PAYROLL_EXPORT,
  ],
  Auditor: [
    PERMISSIONS.HR_PAYROLL_VIEW,
    PERMISSIONS.HR_PAYROLL_EXPORT,
  ],
};

async function seedHrPayrollAccess() {
  await connectDB();
  const roles = await Role.find({});
  let updated = 0;
  for (const role of roles) {
    const additions = ROLE_ACCESS[role.name] || [];
    if (!additions.length) continue;
    const permissions = [...new Set([...(role.permissions || []), ...additions])];
    if (permissions.length === (role.permissions || []).length) continue;
    await Role.updateOne({ _id: role._id }, { permissions });
    updated += 1;
  }

  await RbacService.migrateLegacyAccess();
  console.log(`\n💵 HR Payroll access seeded for ${updated} existing role(s).`);
  console.log("   Payroll is available to HR, finance, administrators, and auditors per the role matrix.\n");
}

if (require.main === module) {
  seedHrPayrollAccess().catch((error) => {
    console.error("HR Payroll access seed failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { seedHrPayrollAccess, ROLE_ACCESS };
