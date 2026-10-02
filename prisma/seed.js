/**
 * Prisma seed for Postgres (Supabase).
 *
 * Idempotent by construction: every write is an `upsert` keyed on a natural
 * unique column, so running this many times creates nothing new and never
 * duplicates a row. Re-running is safe and reports created vs skipped.
 *
 * Reuses the canonical definitions already in the codebase so the Postgres
 * seed and the legacy fileDB seed cannot drift:
 *   - MODULES      <- src/seeds/seedRbacModules.js
 *   - DEFAULT_ROLES<- src/seeds/seedRolesAndSuperAdmin.js
 *
 * Run with: npm run prisma:seed
 */

const bcrypt = require("bcryptjs");
const { prisma } = require("../src/config/prisma");
const { MODULES } = require("../src/seeds/seedRbacModules");
const { DEFAULT_ROLES } = require("../src/seeds/seedRolesAndSuperAdmin");
const { PERMISSIONS } = require("../src/config/legacyPermissions");
const env = require("../src/config/env");

const stats = { created: 0, skipped: 0 };
const created = [];
const skipped = [];

const mark = (kind, label) => {
  stats.created += 1;
  created.push(`${kind}: ${label}`);
};
const skip = (kind, label) => {
  stats.skipped += 1;
  skipped.push(`${kind}: ${label}`);
};

// -- Numbering rules --------------------------------------------
const NUMBERING_RULES = [
  { entityType: "member", prefix: "MEM", padLength: 6, resetPolicy: "never" },
  { entityType: "plot", prefix: "PLT", padLength: 6, resetPolicy: "never" },
  { entityType: "receipt", prefix: "RCP", padLength: 6, resetPolicy: "yearly" },
  { entityType: "invoice", prefix: "INV", padLength: 6, resetPolicy: "yearly" },
  { entityType: "payment", prefix: "PAY", padLength: 6, resetPolicy: "yearly" },
  { entityType: "complaint", prefix: "CMP", padLength: 6, resetPolicy: "yearly" },
  { entityType: "noc", prefix: "NOC", padLength: 6, resetPolicy: "yearly" },
  { entityType: "document", prefix: "DOC", padLength: 6, resetPolicy: "never" },
  { entityType: "application", prefix: "APP", padLength: 6, resetPolicy: "yearly" },
  { entityType: "purchaseRequest", prefix: "PR", padLength: 6, resetPolicy: "yearly" },
  { entityType: "quotation", prefix: "QT", padLength: 6, resetPolicy: "yearly" },
  { entityType: "purchaseOrder", prefix: "PO", padLength: 6, resetPolicy: "yearly" },
  { entityType: "appointment", prefix: "APT", padLength: 4, resetPolicy: "daily" },
  { entityType: "grn", prefix: "GRN", padLength: 6, resetPolicy: "yearly" },
];

async function seedModules() {
  for (const [key, label, description, group, icon, sortOrder, route, showInSidebar = true] of MODULES) {
    const data = { label, description, group, icon, sortOrder, route, showInSidebar, isActive: true };
    const before = await prisma.rbacModule.findUnique({ where: { key } });
    await prisma.rbacModule.upsert({ where: { key }, create: { key, ...data }, update: data });
    if (before) skip("module", key);
    else mark("module", key);
  }
}

async function seedRoles() {
  for (const roleData of DEFAULT_ROLES) {
    const permissions = [
      ...new Set([
        ...(roleData.permissions || []).filter(Boolean),
        PERMISSIONS.NOTICES_VIEW,
        PERMISSIONS.DASHBOARDS_VIEW,
        PERMISSIONS.REPORTS_VIEW,
      ]),
    ];
    const data = {
      description: roleData.description,
      permissions,
      isSystemRole: roleData.isSystemRole || false,
      isSystem: roleData.isSystemRole || false,
    };
    const before = await prisma.role.findUnique({ where: { name: roleData.name } });
    await prisma.role.upsert({ where: { name: roleData.name }, create: { name: roleData.name, ...data }, update: data });
    if (before) skip("role", roleData.name);
    else mark("role", roleData.name);
  }
}

async function seedNumberingRules() {
  for (const rule of NUMBERING_RULES) {
    const data = { prefix: rule.prefix, padLength: rule.padLength, resetPolicy: rule.resetPolicy, isActive: true };
    const before = await prisma.numberingRule.findUnique({ where: { entityType: rule.entityType } });
    // Deliberately does NOT touch currentSequence on update: reseeding must
    // never rewind a numbering sequence that is already in use.
    await prisma.numberingRule.upsert({
      where: { entityType: rule.entityType },
      create: { entityType: rule.entityType, currentSequence: 0, ...data },
      update: data,
    });
    if (before) skip("numberingRule", rule.entityType);
    else mark("numberingRule", rule.entityType);
  }
}

async function seedSocietySettings() {
  const before = await prisma.societySettings.findUnique({ where: { id: "default" } });
  if (!before) {
    await prisma.societySettings.create({ data: { id: "default" } });
    mark("societySettings", "default");
  } else {
    skip("societySettings", "default");
  }
}

/**
 * Super Admin.
 *
 * Refuses to seed rather than silently creating a weak or placeholder
 * credential. The legacy seed fell back to a hardcoded "SuperAdmin@123" and
 * printed the password to stdout; neither is acceptable.
 */
async function seedSuperAdmin() {
  const email = (env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = env.SUPERADMIN_PASSWORD || "";
  const PLACEHOLDER = "change_me_in_production";

  if (!email || !password) {
 console.log("\n SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set - skipping Super Admin user.");
    return;
  }
  if (password === PLACEHOLDER) {
    throw new Error("Refusing to seed: SUPERADMIN_PASSWORD is still the .env.example placeholder.");
  }
  if (password.length < 12) {
    throw new Error(`Refusing to seed: SUPERADMIN_PASSWORD is too weak (${password.length} chars, minimum 12).`);
  }
  if (/^(superadmin|admin|password|123)/i.test(password)) {
    throw new Error("Refusing to seed: SUPERADMIN_PASSWORD looks like a default/guessable value.");
  }

  const role = await prisma.role.findUnique({ where: { name: "Super Admin" } });
  if (!role) throw new Error('Cannot seed Super Admin: the "Super Admin" role is missing.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: existing.id, roleId: role.id } },
      create: { userId: existing.id, roleId: role.id },
      update: {},
    });
    skip("superAdmin", email);
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: "Super Admin",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      isActive: true,
      // Forced reset on first login: the seed must not leave a
      // long-lived, operator-chosen password in circulation.
      mustResetPassword: true,
      userRoles: { create: { roleId: role.id } },
    },
  });
  mark("superAdmin", `${email} (id=${user.id})`);
}

/** RoleModuleAccess grid, derived from each role's legacy permission list. */
async function seedRoleAccess() {
  const RbacService = require("../src/modules/rbac/service");
  const roles = await prisma.role.findMany();
  for (const role of roles) {
    await RbacService.ensureRoleModuleAccess(role.id);
  }
  skip("roleAccess", `${roles.length} roles synced`);
}

async function main() {
 console.log("\n Seeding Postgres (Prisma)...\n");
  await seedModules();
  await seedRoles();
  await seedNumberingRules();
  await seedSocietySettings();
  await seedSuperAdmin();
  await seedRoleAccess();

 console.log(`\n Created (${stats.created}):`);
  for (const item of created) console.log(`   + ${item}`);
 console.log(`\n Skipped/already present (${stats.skipped}):`);
  for (const item of skipped) console.log(`   = ${item}`);
  console.log("");
}

// Exported so src/config/bootstrap.js can reuse the exact same idempotent
// seeding on serverless cold starts. Running the file directly is the
// `npm run prisma:seed` path.
module.exports = { run: main, NUMBERING_RULES, stats };

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Seed failed:", error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
