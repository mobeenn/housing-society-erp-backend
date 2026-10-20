/**
 * P2-2: Matrix assertion — seeded actions match IMPROVEMENT_PLAN table.
 */
const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const { connectDB } = require("../src/config/db");
const { prisma } = require("../src/config/prisma");
const { seedRoleRedefinition, expectedForRole } = require("../src/seeds/seedRoleRedefinition");
const { ROLE_NAMES, ACTIONS, HIDDEN_ACCESS_CONTROL_KEYS } = require("../src/seeds/roleMatrix");

describe("P2 role matrix seed", () => {
  before(async () => {
    await connectDB();
    await seedRoleRedefinition({ force: true, reportOnly: false });
  });

  for (const roleName of ROLE_NAMES) {
    test(`${roleName} grants match matrix`, async () => {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        assert.fail(`Role missing: ${roleName}`);
      }
      const modules = await prisma.rbacModule.findMany();
      const records = await prisma.roleModuleAccess.findMany({ where: { roleId: role.id } });
      const byModuleId = new Map(records.map((r) => [r.moduleId, r]));
      const expected = expectedForRole(roleName);

      for (const [moduleKey, grant] of Object.entries(expected)) {
        if (HIDDEN_ACCESS_CONTROL_KEYS.includes(moduleKey)) continue;
        const module = modules.find((m) => m.key === moduleKey);
        if (!module) continue;
        const record = byModuleId.get(module.id);
        assert.equal(
          record?.isVisible === true,
          grant.isVisible,
          `${roleName}/${moduleKey} isVisible`
        );
        for (const action of ACTIONS) {
          const actual = record?.actions?.[action] === true;
          const want = grant.actions[action] === true;
          assert.equal(actual, want, `${roleName}/${moduleKey}/${action}`);
        }
      }
    });
  }

  test("dealers and finance-gl are hidden from access grid helper", () => {
    assert.ok(HIDDEN_ACCESS_CONTROL_KEYS.includes("dealers"));
    assert.ok(HIDDEN_ACCESS_CONTROL_KEYS.includes("finance-gl"));
  });
});
