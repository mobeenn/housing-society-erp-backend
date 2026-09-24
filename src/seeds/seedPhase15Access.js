const { connectDB } = require("../config/db");
const Role = require("../modules/auth/role.model");
const RbacService = require("../modules/rbac/service");
const { PERMISSIONS } = require("../config/legacyPermissions");

const ROLE_ACCESS = {
  "Society Admin": [
    PERMISSIONS.PLOT_MERGE_VIEW, PERMISSIONS.PLOT_MERGE_CREATE, PERMISSIONS.PLOT_MERGE_EXPORT,
    PERMISSIONS.BUYBACK_VIEW, PERMISSIONS.BUYBACK_CREATE, PERMISSIONS.BUYBACK_EXPORT,
    PERMISSIONS.REGISTRY_VIEW, PERMISSIONS.REGISTRY_CREATE, PERMISSIONS.REGISTRY_EDIT,
    PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_EDIT,
  ],
  "Operations Manager": [
    PERMISSIONS.REGISTRY_VIEW, PERMISSIONS.REGISTRY_CREATE, PERMISSIONS.REGISTRY_EDIT,
    PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_EDIT,
  ],
  "Property Officer": [
    PERMISSIONS.REGISTRY_VIEW, PERMISSIONS.REGISTRY_CREATE,
  ],
  Receptionist: [
    PERMISSIONS.REGISTRY_VIEW, PERMISSIONS.REGISTRY_CREATE, PERMISSIONS.REGISTRY_EDIT,
    PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_EDIT,
  ],
  Auditor: [
    PERMISSIONS.REGISTRY_VIEW,
    PERMISSIONS.APPOINTMENTS_VIEW,
  ],
};

async function seedPhase15Access() {
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
  console.log(`\n🧭 Phase 15 access seeded for ${updated} existing role(s).`);
  console.log("   Plot merge/buyback are admin-only by default; registry and appointments are front-desk scoped.\n");
}

if (require.main === module) {
  seedPhase15Access().catch((error) => {
    console.error("Phase 15 access seed failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { seedPhase15Access, ROLE_ACCESS };
