/**
 * P2-2: Apply IMPROVEMENT_PLAN role matrix to RoleModuleAccess.
 *
 *   node src/seeds/seedRoleRedefinition.js
 *   node src/seeds/seedRoleRedefinition.js --force
 *   node src/seeds/seedRoleRedefinition.js --report
 *   node src/seeds/seedRoleRedefinition.js --role "Finance Officer"
 */
const crypto = require("crypto");
const { connectDB } = require("../config/db");
const { prisma } = require("../config/prisma");
const RbacService = require("../modules/rbac/service");
const {
  ROLE_NAMES,
  MATRIX,
  HIDDEN_ACCESS_CONTROL_KEYS,
  expectedForRole,
  fingerprintGrants,
  fingerprintFromRecords,
  isLegacyEmpty,
} = require("./roleMatrix");

const VERSION = "role-redefinition-v1";
const META_TYPE = "roleRedefinition";
const META_NAME = "version";

const args = process.argv.slice(2);
const force = args.includes("--force");
const reportOnly = args.includes("--report");
const roleFlagIdx = args.indexOf("--role");
const onlyRoleName = roleFlagIdx >= 0 ? args[roleFlagIdx + 1] : null;

async function loadMeta() {
  const row = await prisma.masterData.findFirst({
    where: { type: META_TYPE, name: META_NAME },
  });
  if (!row) return { version: null, fingerprints: {} };
  try {
    const parsed = JSON.parse(row.description || "{}");
    return {
      version: parsed.version || row.code || null,
      fingerprints: parsed.fingerprints || {},
    };
  } catch {
    return { version: null, fingerprints: {} };
  }
}

async function saveMeta(fingerprints) {
  const description = JSON.stringify({ version: VERSION, fingerprints });
  await prisma.masterData.upsert({
    where: { type_name: { type: META_TYPE, name: META_NAME } },
    create: {
      type: META_TYPE,
      name: META_NAME,
      code: VERSION,
      description,
    },
    update: {
      code: VERSION,
      description,
    },
  });
}

async function applyRoleGrants(role, modules, grants) {
  for (const module of modules) {
    if (HIDDEN_ACCESS_CONTROL_KEYS.includes(module.key)) continue;
    const grant = grants[module.key];
    if (!grant) continue;
    await prisma.roleModuleAccess.upsert({
      where: { roleId_moduleId: { roleId: role.id, moduleId: module.id } },
      create: {
        roleId: role.id,
        moduleId: module.id,
        isVisible: grant.isVisible,
        actions: grant.actions,
        updatedById: null,
      },
      update: {
        isVisible: grant.isVisible,
        actions: grant.actions,
        updatedById: null,
      },
    });
  }
  RbacService.invalidateMyAccessCache?.();
}

/**
 * Apply matrix for a single role (used by seed and reset-to-default API).
 */
async function applyMatrixForRole(roleName, { force: forceApply = true } = {}) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) return { skipped: true, reason: "role_not_found", roleName };
  if (role.name === "Super Admin") {
    return { skipped: true, reason: "super_admin", roleName };
  }
  const modules = await prisma.rbacModule.findMany({ orderBy: { sortOrder: "asc" } });
  const records = await prisma.roleModuleAccess.findMany({ where: { roleId: role.id } });
  const meta = await loadMeta();
  const expected = expectedForRole(roleName);
  const expectedFp = fingerprintGrants(expected);
  const currentFp = fingerprintFromRecords(modules, records);
  const previousFp = meta.fingerprints[role.id];

  const matchesPrevious = previousFp && currentFp === previousFp;
  const empty = isLegacyEmpty(modules, records);
  const matchesExpected = currentFp === expectedFp;

  if (!forceApply && !matchesPrevious && !empty && !matchesExpected) {
    return {
      skipped: true,
      reason: "customized",
      roleName,
      roleId: role.id,
      currentFp: crypto.createHash("sha1").update(currentFp).digest("hex").slice(0, 10),
    };
  }

  await applyRoleGrants(role, modules, expected);
  return {
    skipped: false,
    applied: true,
    roleName,
    roleId: role.id,
    fingerprint: expectedFp,
  };
}

async function seedRoleRedefinition(options = {}) {
  const useForce = options.force ?? force;
  const useReport = options.reportOnly ?? reportOnly;
  const filterRole = options.roleName ?? onlyRoleName;

  await connectDB();
  const modules = await prisma.rbacModule.findMany({ orderBy: { sortOrder: "asc" } });
  const meta = await loadMeta();
  const roles = await prisma.role.findMany({
    where: {
      name: filterRole
        ? filterRole
        : { in: ROLE_NAMES },
    },
  });

  const report = {
    version: VERSION,
    force: useForce,
    reportOnly: useReport,
    applied: [],
    skipped: [],
    missing: [],
  };

  for (const roleName of filterRole ? [filterRole] : ROLE_NAMES) {
    const role = roles.find((r) => r.name === roleName);
    if (!role) {
      report.missing.push(roleName);
      console.log(`   ⚠️  Role missing: ${roleName}`);
      continue;
    }

    const records = await prisma.roleModuleAccess.findMany({ where: { roleId: role.id } });
    const expected = expectedForRole(roleName);
    const expectedFp = fingerprintGrants(expected);
    const currentFp = fingerprintFromRecords(modules, records);
    const previousFp = meta.fingerprints[role.id];
    const matchesPrevious = previousFp && currentFp === previousFp;
    const empty = isLegacyEmpty(modules, records);
    const matchesExpected = currentFp === expectedFp;
    const diverged = !matchesPrevious && !empty && !matchesExpected;

    if (useReport) {
      const status = matchesExpected
        ? "matches_matrix"
        : diverged
          ? "customized"
          : empty
            ? "empty_legacy"
            : matchesPrevious
              ? "matches_previous_seed"
              : "unknown";
      console.log(`   📋 ${roleName}: ${status}`);
      if (diverged) report.skipped.push({ roleName, reason: "customized" });
      else if (matchesExpected) report.applied.push({ roleName, reason: "already_ok" });
      else report.applied.push({ roleName, reason: status });
      continue;
    }

    if (!useForce && diverged) {
      console.log(`   ⏭️  Skip customized role: ${roleName}`);
      report.skipped.push({ roleName, reason: "customized" });
      continue;
    }

    await applyRoleGrants(role, modules, expected);
    meta.fingerprints[role.id] = expectedFp;
    console.log(`   ✅ Applied matrix: ${roleName}${useForce ? " (force)" : ""}`);
    report.applied.push({ roleName, roleId: role.id });
  }

  if (!useReport) {
    await saveMeta(meta.fingerprints);
    if (typeof RbacService.invalidateMyAccessCache === "function") {
      RbacService.invalidateMyAccessCache();
    }
  }

  console.log(
    `\n🔐 Role redefinition ${useReport ? "report" : "seed"} — applied ${report.applied.length}, skipped ${report.skipped.length}, missing ${report.missing.length}\n`
  );
  return report;
}

if (require.main === module) {
  seedRoleRedefinition()
    .catch((error) => {
      console.error("Role redefinition seed failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
    });
}

module.exports = {
  VERSION,
  seedRoleRedefinition,
  applyMatrixForRole,
  expectedForRole,
  MATRIX,
};
