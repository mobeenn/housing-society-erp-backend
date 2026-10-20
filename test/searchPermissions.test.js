/**
 * P0-4 / P2-6: Global search only returns categories the caller can view.
 * Re-verified after role matrix seed (Guard: no members/plots/receipts; Finance: payments).
 */
const { test, mock } = require("node:test");
const assert = require("node:assert/strict");

const RbacService = require("../src/modules/rbac/service");
const SearchService = require("../src/modules/search/service");

test("Security Guard cannot see members, plots, or receipts in search", async () => {
  const allowed = new Set(["visitors", "notices", "dashboards", "reports"]);
  mock.method(RbacService, "isAllowed", async (_user, moduleKey) => allowed.has(moduleKey));
  mock.method(RbacService, "isSuperAdmin", () => false);

  const configs = await SearchService.allowedConfigs({ _id: "guard-user", roles: [] });
  const modules = configs.map((c) => c.module);
  assert.ok(!modules.includes("members"));
  assert.ok(!modules.includes("plots"));
  assert.ok(!modules.includes("payments"));
  assert.ok(modules.includes("visitors"));

  mock.restoreAll();
});

test("Finance Officer can search receipts (payments)", async () => {
  const allowed = new Set(["payments", "refunds", "reports", "dashboards", "notices"]);
  mock.method(RbacService, "isAllowed", async (_user, moduleKey) => allowed.has(moduleKey));
  mock.method(RbacService, "isSuperAdmin", () => false);

  const configs = await SearchService.allowedConfigs({ _id: "finance-user", roles: [] });
  const modules = configs.map((c) => c.module);
  assert.ok(modules.includes("payments"));
  assert.ok(!modules.includes("members"));
  assert.ok(!modules.includes("plots"));

  mock.restoreAll();
});

test("Super Admin is allowed every search category via isAllowed bypass", async () => {
  mock.method(RbacService, "isAllowed", async () => true);
  const configs = await SearchService.allowedConfigs({
    _id: "admin",
    roles: [{ name: "Super Admin", permissions: ["system:admin"] }],
  });
  assert.equal(configs.length, SearchService.SEARCH_CONFIG.length);
  mock.restoreAll();
});
