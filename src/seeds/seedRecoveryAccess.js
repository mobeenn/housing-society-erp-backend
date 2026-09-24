const { connectDB } = require("../config/db");
const Role = require("../modules/auth/role.model");
const RbacService = require("../modules/rbac/service");
const { PERMISSIONS } = require("../config/legacyPermissions");

const ROLE_ACCESS = {
  "Society Admin": [
    PERMISSIONS.RECOVERY_VIEW,
    PERMISSIONS.RECOVERY_CREATE,
    PERMISSIONS.RECOVERY_EDIT,
    PERMISSIONS.RECOVERY_APPROVE,
    PERMISSIONS.RECOVERY_EXPORT,
  ],
  "Finance Officer": [
    PERMISSIONS.RECOVERY_VIEW,
    PERMISSIONS.RECOVERY_CREATE,
    PERMISSIONS.RECOVERY_EDIT,
    PERMISSIONS.RECOVERY_APPROVE,
    PERMISSIONS.RECOVERY_EXPORT,
  ],
  "Property Officer": [
    PERMISSIONS.RECOVERY_VIEW,
    PERMISSIONS.RECOVERY_EDIT,
    PERMISSIONS.RECOVERY_EXPORT,
  ],
  "Operations Manager": [
    PERMISSIONS.RECOVERY_VIEW,
    PERMISSIONS.RECOVERY_EDIT,
    PERMISSIONS.RECOVERY_EXPORT,
  ],
  Auditor: [
    PERMISSIONS.RECOVERY_VIEW,
    PERMISSIONS.RECOVERY_EXPORT,
  ],
};

async function seedRecoveryAccess() {
  await connectDB();
  const roles = await Role.find({});
  let updated = 0;
  for (const role of roles) {
    const additions = ROLE_ACCESS[role.name] || [];
    if (!additions.length) continue;
    const permissions = [...new Set([...(role.permissions || []), ...additions])];
    if (permissions.length === (role.permissions || []).length) continue;
    await Role.updateOne({ _id: role._id }, { permissions, updatedAt: new Date().toISOString() });
    updated += 1;
  }

  // Recompute the affected role grids and keep migration fingerprints current.
  await RbacService.migrateLegacyAccess();

  console.log(`\n♻️ Recovery access seeded for ${updated} existing role(s).`);
  console.log("   Recovery is now available to supervisors, agents, and auditors per the role matrix.\n");
}

if (require.main === module) {
  seedRecoveryAccess().catch((error) => {
    console.error("Recovery access seed failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { seedRecoveryAccess, ROLE_ACCESS };
