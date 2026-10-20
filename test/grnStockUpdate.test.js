/**
 * P1-3: GRN receipt increases inventory exactly once (idempotent).
 */
const { test, before } = require("node:test");
const assert = require("node:assert");

const InventoryService = require("../src/modules/inventory/service");
const InventoryItem = require("../src/modules/inventory/model");
const { connectDB } = require("../src/config/db");

before(async () => {
  await connectDB();
});

test("GRN of 10 units increases stock by 10 exactly once", async () => {
  const name = `GRN Cement ${Date.now()}`;
  const grnId = `grn-test-${Date.now()}`;

  const first = await InventoryService.applyGrnReceipt({
    name,
    sku: name.slice(0, 64),
    quantity: 10,
    grnId,
    createdBy: "test-user",
  });
  assert.equal(first.skipped, false);
  assert.equal(first.item.quantity, 10);

  const second = await InventoryService.applyGrnReceipt({
    name,
    sku: name.slice(0, 64),
    quantity: 10,
    grnId,
    createdBy: "test-user",
  });
  assert.equal(second.skipped, true);
  assert.equal(second.item.quantity, 10);

  const refreshed = await InventoryItem.findById(first.item._id);
  assert.equal(Number(refreshed.quantity), 10);
});
