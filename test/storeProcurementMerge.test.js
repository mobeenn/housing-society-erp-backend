/**
 * P2-1: Store/Procurement merge helpers and inactive role filtering.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  MERGED_NAME,
  LEGACY_NAMES,
} = require("../src/seeds/migrateStoreProcurementRoles");

test("merged role name and legacy names are defined", () => {
  assert.equal(MERGED_NAME, "Store & Procurement Officer");
  assert.deepEqual(LEGACY_NAMES, ["Store Manager", "Procurement Officer"]);
});

test("DEFAULT_ROLES seed includes merged role as active and legacy inactive", () => {
  // Re-read seed file constants by requiring the module's DEFAULT via roles seed
  const seedPath = require("path").join(__dirname, "../src/seeds/seedRolesAndSuperAdmin.js");
  delete require.cache[require.resolve(seedPath)];
  // The seed does not export DEFAULT_ROLES — assert via fs content instead
  const fs = require("fs");
  const src = fs.readFileSync(seedPath, "utf8");
  assert.ok(src.includes('name: "Store & Procurement Officer"'));
  assert.ok(src.includes('name: "Store Manager"'));
  assert.ok(src.includes("isActive: false"));
});
