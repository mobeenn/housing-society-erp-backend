/**
 * P2-3: Lookup APIs authorize via members/plots view OR create on picker modules.
 */
const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const RbacService = require("../src/modules/rbac/service");
const LookupService = require("../src/modules/lookups/service");

test("Security Guard with visitors create can lookup members", async () => {
  mock.method(RbacService, "isSuperAdmin", () => false);
  mock.method(RbacService, "isAllowed", async (_user, moduleKey, action) => {
    if (moduleKey === "visitors" && action === "create") return true;
    return false;
  });

  assert.equal(await LookupService.canUseMemberLookup({ _id: "guard" }), true);
  assert.ok(LookupService.maskCnic("35202-1234567-1").includes("*******"));

  mock.restoreAll();
});

test("Role with no view/create is denied member lookup", async () => {
  mock.method(RbacService, "isSuperAdmin", () => false);
  mock.method(RbacService, "isAllowed", async () => false);

  assert.equal(await LookupService.canUseMemberLookup({ _id: "none" }), false);
  await assert.rejects(
    () => LookupService.searchMembers({ _id: "none" }, { q: "x" }),
    (err) => Number(err.statusCode || err.status) === 403
  );

  mock.restoreAll();
});
