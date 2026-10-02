/**
 * Role assignment, removal and permission checks.
 *
 * The `user_roles` join table is the single source of truth for role
 * membership. These tests assert that against the real database: assign,
 * authorise, remove, and confirm the permission disappears.
 *
 * Every user/role created here is removed in teardown.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const { prisma } = require("../src/config/prisma");
const RbacService = require("../src/modules/rbac/service");
const { withLegacyId } = require("../src/middlewares/auth");

const created = { users: [], roles: [], access: [] };
const stamp = Date.now();
const email = (n) => `role-test-${stamp}-${n}@example.test`;

test("role membership lives in the user_roles join table", async (t) => {
  await t.after(async () => {
    for (const id of created.access) await prisma.roleModuleAccess.deleteMany({ where: { id } });
    for (const id of created.users) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    for (const id of created.roles) {
      await prisma.roleModuleAccess.deleteMany({ where: { roleId: id } });
      await prisma.role.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  await t.test("assigning a role creates a join row, not a user column", async () => {
    const role = await prisma.role.create({
      data: { name: `RoleTest Role ${stamp}`, description: "temp", permissions: [] },
    });
    created.roles.push(role.id);

    const user = await prisma.user.create({
      data: {
        name: "Role Test User",
        email: email(1),
        passwordHash: await bcrypt.hash("Test@123456", 10),
        isActive: true,
      },
    });
    created.users.push(user.id);
    assert.equal(user.id, user.id);

    // no roles yet
    let loaded = await prisma.user.findUnique({
      where: { id: user.id },
      include: { userRoles: true },
    });
    assert.equal(loaded.userRoles.length, 0, "user starts with no roles");

    // assign
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    loaded = await prisma.user.findUnique({
      where: { id: user.id },
      include: { userRoles: { include: { role: true } } },
    });
    assert.equal(loaded.userRoles.length, 1);
    assert.equal(loaded.userRoles[0].roleId, role.id);
    assert.equal(loaded.userRoles[0].role.name, role.name);
  });

  await t.test("the users table has no roles column any more", async () => {
    const columns = await prisma.$queryRaw`
      SELECT column_name::text AS name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'roles'
    `;
    assert.equal(columns.length, 0, "users.roles must be gone");
  });

  await t.test("duplicate assignment is rejected by the unique constraint", async () => {
    const role = await prisma.role.findFirst({ where: { name: `RoleTest Role ${stamp}` } });
    const user = await prisma.user.findFirst({ where: { email: email(1) } });
    await assert.rejects(
      () => prisma.userRole.create({ data: { userId: user.id, roleId: role.id } }),
      (err) => err.code === "P2002"
    );
    // upsert is the safe path
    const upserted = await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
    assert.ok(upserted.id);
  });

  await t.test("a role with no access grants nothing", async () => {
    const user = await prisma.user.findFirst({ where: { email: email(1) } });
    const roles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });
    const authUser = {
      id: user.id,
      roles: roles.map((r) => withLegacyId(r.role)),
    };
    assert.equal(await RbacService.isAllowed(authUser, "members", "view"), false);
    assert.equal(RbacService.isSuperAdmin(authUser), false);
  });

  await t.test("granting access through roleModuleAccess allows the action", async () => {
    const role = await prisma.role.findFirst({ where: { name: `RoleTest Role ${stamp}` } });
    const user = await prisma.user.findFirst({ where: { email: email(1) } });
    const module = await prisma.rbacModule.findUnique({ where: { key: "members" } });

    const access = await prisma.roleModuleAccess.create({
      data: {
        roleId: role.id,
        moduleId: module.id,
        isVisible: true,
        actions: { view: true, create: false },
      },
    });
    created.access.push(access.id);

    const roles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });
    const authUser = { id: user.id, roles: roles.map((r) => withLegacyId(r.role)) };

    assert.equal(await RbacService.isAllowed(authUser, "members", "view"), true, "view granted");
    assert.equal(await RbacService.isAllowed(authUser, "members", "create"), false, "create not granted");
    assert.equal(await RbacService.isAllowed(authUser, "plots", "view"), false, "other module denied");
  });

  await t.test("roleIds() resolves ids from the populated relation", async () => {
    const user = await prisma.user.findFirst({ where: { email: email(1) } });
    const role = await prisma.role.findFirst({ where: { name: `RoleTest Role ${stamp}` } });
    const roles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });
    const ids = RbacService.roleIds({ id: user.id, roles: roles.map((r) => withLegacyId(r.role)) });
    assert.deepEqual(ids, [role.id]);
  });

  await t.test("removing the role revokes the permission", async () => {
    const role = await prisma.role.findFirst({ where: { name: `RoleTest Role ${stamp}` } });
    const user = await prisma.user.findFirst({ where: { email: email(1) } });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      include: { userRoles: true },
    });
    assert.equal(after.userRoles.length, 0, "join rows removed");

    const authUser = { id: user.id, roles: [] };
    assert.equal(await RbacService.isAllowed(authUser, "members", "view"), false, "access revoked");
  });

  await t.test("Super Admin is detected by role name from the relation", async () => {
    const admin = await prisma.user.findFirst({
      where: { email: "admin@housing-society.local" },
      include: { userRoles: { include: { role: true } } },
    });
    assert.ok(admin, "seeded Super Admin exists");
    const authUser = { id: admin.id, roles: admin.userRoles.map((r) => withLegacyId(r.role)) };
    assert.equal(RbacService.isSuperAdmin(authUser), true);
    assert.equal(await RbacService.isAllowed(authUser, "anything-not-registered", "view"), true);
    assert.equal(RbacService.dashboardTypeForUser(authUser), "management");
  });

  await t.test("no join row points at a missing role, and every seeded user kept its role", async () => {
    const dangling = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM "user_roles" ur
      LEFT JOIN "roles" r ON r.id = ur."roleId"
      WHERE r.id IS NULL
    `;
    assert.equal(dangling[0].n, 0, "no orphaned user_roles rows");

    const users = await prisma.user.findMany({
      include: { userRoles: { include: { role: true } } },
      orderBy: { email: "asc" },
    });
    const expected = {
      "admin@housing-society.local": "Super Admin",
      "finance.demo@housing.local": "Finance Officer",
      "hr.demo@housing.local": "HR Officer",
      "operations.demo@housing.local": "Operations Manager",
      "procurement.demo@housing.local": "Procurement Officer",
      "receptionist.demo@housing.local": "Receptionist",
      "security.demo@housing.local": "Security Manager",
      "store.demo@housing.local": "Store Manager",
    };
    for (const [mail, roleName] of Object.entries(expected)) {
      const user = users.find((u) => u.email === mail);
      assert.ok(user, `${mail} exists`);
      const names = user.userRoles.map((r) => r.role.name);
      assert.ok(names.includes(roleName), `${mail} still has ${roleName} (has: ${names.join(",")})`);
    }
  });
});
