/**
 * P1-1: Inventory create + adjust updates quantity and history.
 */
const { test, before } = require("node:test");
const assert = require("node:assert");

const InventoryService = require("../src/modules/inventory/service");
const InventoryItem = require("../src/modules/inventory/model");
const { connectDB } = require("../src/config/db");

const fakeReq = { user: { _id: "test-user-inventory" }, ip: "127.0.0.1", headers: {} };

before(async () => {
  await connectDB();
});

test("create item and adjust stock in/out updates quantity", async () => {
  const sku = `INV-P1-${Date.now()}`;
  const created = await InventoryService.create(
    { sku, name: "Test Cement Bags", unit: "bag", quantity: 5, reorderLevel: 10 },
    fakeReq
  );
  assert.equal(created.quantity, 5);
  assert.equal(created.lowStock, true);

  const afterIn = await InventoryService.adjust(created._id, { type: "IN", quantity: 8, reason: "Purchase" }, fakeReq);
  assert.equal(afterIn.quantity, 13);
  assert.equal(afterIn.lowStock, false);

  const afterOut = await InventoryService.adjust(created._id, { type: "OUT", quantity: 3, reason: "Issued to site" }, fakeReq);
  assert.equal(afterOut.quantity, 10);

  const history = await InventoryService.history(created._id);
  assert.ok(history.length >= 2);

  await InventoryItem.update(created._id, { status: "Inactive" });
});
