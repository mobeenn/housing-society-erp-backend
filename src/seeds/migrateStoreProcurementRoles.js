/**
 * P2-1: Merge Store Manager + Procurement Officer → Store & Procurement Officer.
 *
 *   node src/seeds/migrateStoreProcurementRoles.js
 *   node src/seeds/migrateStoreProcurementRoles.js --dry-run
 *   node src/seeds/migrateStoreProcurementRoles.js --revert
 */
const { connectDB } = require("../config/db");
const { prisma } = require("../config/prisma");
const Role = require("../modules/auth/role.model");
const { PERMISSIONS } = require("../config/legacyPermissions");
const RbacService = require("../modules/rbac/service");

const MERGED_NAME = "Store & Procurement Officer";
const LEGACY_NAMES = ["Store Manager", "Procurement Officer"];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const revert = args.includes("--revert");

async function ensureMergedRole() {
  let role = await prisma.role.findUnique({ where: { name: MERGED_NAME } });
  if (role) return role;
  if (dryRun) {
    console.log(`   [dry-run] would create role "${MERGED_NAME}"`);
    return { id: "dry-run", name: MERGED_NAME };
  }
  const created = await Role.create({
    name: MERGED_NAME,
    description: "Manages inventory, vendors, purchase requests, quotations, POs and goods received",
    permissions: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_CREATE,
      PERMISSIONS.INVENTORY_EDIT,
      PERMISSIONS.PROCUREMENT_VIEW,
      PERMISSIONS.PROCUREMENT_CREATE,
      PERMISSIONS.PROCUREMENT_EDIT,
      PERMISSIONS.PROCUREMENT_APPROVE,
      PERMISSIONS.ASSETS_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.NOTICES_VIEW,
      PERMISSIONS.DASHBOARDS_VIEW,
    ],
    isSystemRole: true,
    isActive: true,
  });
  await RbacService.ensureRoleModuleAccess(created._id).catch(() => {});
  return prisma.role.findUnique({ where: { id: created._id } });
}

async function migrateForward() {
  console.log(`\n🔀 Merging Store/Procurement roles → "${MERGED_NAME}"${dryRun ? " (dry-run)" : ""}...\n`);
  const merged = await ensureMergedRole();
  const legacy = await prisma.role.findMany({ where: { name: { in: LEGACY_NAMES } } });
  let moved = 0;
  let alreadyOnMerged = 0;

  for (const oldRole of legacy) {
    const links = await prisma.userRole.findMany({ where: { roleId: oldRole.id } });
    for (const link of links) {
      const hasMerged = await prisma.userRole.findFirst({
        where: { userId: link.userId, roleId: merged.id },
      });
      if (hasMerged) {
        alreadyOnMerged += 1;
        if (!dryRun) {
          await prisma.userRole.delete({ where: { id: link.id } });
        }
        continue;
      }
      if (dryRun) {
        console.log(`   [dry-run] move user ${link.userId} from "${oldRole.name}" → merged`);
      } else {
        await prisma.userRole.create({ data: { userId: link.userId, roleId: merged.id } });
        await prisma.userRole.delete({ where: { id: link.id } });
      }
      moved += 1;
    }
    if (!dryRun) {
      await prisma.role.update({
        where: { id: oldRole.id },
        data: { isActive: false },
      });
      console.log(`   ✅ Marked "${oldRole.name}" inactive`);
    } else {
      console.log(`   [dry-run] would mark "${oldRole.name}" inactive (${links.length} user link(s))`);
    }
  }

  if (!dryRun && merged.id !== "dry-run") {
    await prisma.role.update({
      where: { id: merged.id },
      data: { isActive: true },
    });
  }

  console.log(`\n📊 Users moved onto merged role: ${moved}`);
  console.log(`📊 Already had merged role (legacy link removed): ${alreadyOnMerged}`);
  console.log(`📊 Legacy roles found: ${legacy.length}\n`);
  return { moved, alreadyOnMerged, legacyCount: legacy.length };
}

async function migrateRevert() {
  console.log(`\n⏪ Reverting merge (reactivate legacy roles)${dryRun ? " (dry-run)" : ""}...\n`);
  const merged = await prisma.role.findUnique({ where: { name: MERGED_NAME } });
  if (!merged) {
    console.log("   Nothing to revert — merged role not found.\n");
    return { reactivated: 0 };
  }
  for (const name of LEGACY_NAMES) {
    const role = await prisma.role.findUnique({ where: { name } });
    if (!role) continue;
    if (dryRun) {
      console.log(`   [dry-run] would set "${name}" active`);
    } else {
      await prisma.role.update({ where: { id: role.id }, data: { isActive: true } });
      console.log(`   ✅ Reactivated "${name}"`);
    }
  }
  console.log(
    "\n⚠️  User assignments are not automatically moved back. Re-assign users manually if needed.\n"
  );
  return { reactivated: LEGACY_NAMES.length };
}

async function main() {
  await connectDB();
  const result = revert ? await migrateRevert() : await migrateForward();
  return result;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("\n❌ Migration failed:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
    });
}

module.exports = { migrateForward, migrateRevert, MERGED_NAME, LEGACY_NAMES };
