/**
 * SRS Section 17 - Maintenance module end-to-end flow test.
 * 1. Register an asset (asset registry)
 * 2. File a complaint that will spawn a work order
 * 3. Create a work order from the existing complaint (linked to the asset)
 * 4. Invalid transitions rejected (complete from Open, cancel after completion)
 * 5. Log progress (Open -> InProgress automatically, then a second entry)
 * 6. Mark the work order complete (requires completion note)
 * 7. View the work order in the asset's maintenance history
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert");

const { connectDB, db } = require("../src/config/db");
const { AssetService, WorkOrderService } = require("../src/modules/maintenance/service");
const { WorkOrder } = require("../src/modules/maintenance/workOrder.model");
const { STATUSES } = require("../src/modules/maintenance/maintenance.config");
const ComplaintService = require("../src/modules/complaints/service");
const { Complaint } = require("../src/modules/complaints/complaint.model");
const Member = require("../src/modules/members/member.model");

const fakeReq = {
  user: { _id: "test-maintenance-user" },
  ip: "127.0.0.1",
  headers: { "user-agent": "maintenance-flow-test" },
};

let memberId;
let assetId;
let complaintId;
let workOrderId;

const cleanup = async () => {
  if (workOrderId) {
    await db.collection(WorkOrder.collectionName).deleteOne({ _id: workOrderId });
    await db.collection("auditLogs").deleteMany({ entityId: workOrderId });
  }
  if (complaintId) {
    await db.collection(Complaint.collectionName).deleteOne({ _id: complaintId });
    await db.collection("auditLogs").deleteMany({ entityId: complaintId });
  }
  if (assetId) {
    await db.collection("assets").deleteOne({ _id: assetId });
    await db.collection("auditLogs").deleteMany({ entityId: assetId });
  }
  await db.collection("auditLogs").deleteMany({ userId: fakeReq.user._id });
  if (memberId) await db.collection(Member.collectionName).deleteOne({ _id: memberId });
};

before(async () => {
  await connectDB();
  const member = await db.collection(Member.collectionName).insertOne({
    memberId: "TEST-MAINT-MEMBER",
    name: "Maintenance Flow Member",
    cnic: "0000000000009",
    status: Member.STATUS.ACTIVE,
  });
  memberId = member._id;
});

after(async () => {
  await cleanup();
});

test("1. Register an asset in the registry", async () => {
  const asset = await AssetService.create(
    {
      name: "Main Boulevard Street Lights",
      type: "light",
      location: "Block A, Main Boulevard",
      block: null,
    },
    fakeReq
  );
  assetId = asset._id;
  assert.strictEqual(asset.name, "Main Boulevard Street Lights");
  assert.strictEqual(asset.type, "light");
  assert.strictEqual(asset.location, "Block A, Main Boulevard");
  assert.strictEqual(asset.block, null);
});

test("2. File the complaint that will spawn a work order", async () => {
  const complaint = await ComplaintService.create(
    {
      member: memberId,
      plot: null,
      category: "Electricity",
      priority: "High",
      location: "Block A, Main Boulevard",
      description: "Three street lights on the main boulevard are not working.",
      attachments: [],
    },
    fakeReq
  );
  complaintId = complaint._id;
  assert.strictEqual(complaint.status, "New");
});

test("3. Create a work order from the existing complaint", async () => {
  const workOrder = await WorkOrderService.create(
    {
      asset: assetId,
      relatedComplaint: complaintId,
      description: "Replace failed LED bulbs on Main Boulevard street lights.",
      assignedStaff: null,
      contractor: "City Electricians (Pvt) Ltd",
      priority: "High",
      expectedCompletion: "2026-10-01",
      materials: [
        { item: "LED bulb 100W", quantity: "3" },
        { item: "Pole ladder hire", quantity: "1" },
      ],
      laborCost: 5000,
      materialCost: 4500,
    },
    fakeReq
  );
  workOrderId = workOrder._id;
  assert.strictEqual(workOrder.status, STATUSES.OPEN);
  assert.strictEqual(workOrder.asset, assetId);
  assert.strictEqual(workOrder.relatedComplaint, complaintId);
  assert.strictEqual(workOrder.assetRef?.name, "Main Boulevard Street Lights");
  assert.strictEqual(workOrder.relatedComplaintRef?._id, complaintId);
  assert.strictEqual(workOrder.materials.length, 2);
  assert.strictEqual(workOrder.materials[0].quantity, 3);
  assert.strictEqual(workOrder.totalCost, 9500);
  assert.strictEqual(workOrder.progressLog.length, 0);
});

test("4. Invalid transitions are rejected", async () => {
  // Cannot complete straight from Open
  await assert.rejects(
    () =>
      WorkOrderService.complete(
        workOrderId,
        { completionNote: "Should not be allowed yet" },
        fakeReq
      ),
    (error) => {
      assert.strictEqual(error.statusCode, 409);
      assert.match(error.message, /Cannot complete/i);
      return true;
    }
  );
  // Generic status endpoint cannot mark Completed (dedicated endpoint required)
  await assert.rejects(
    () => WorkOrderService.changeStatus(workOrderId, { status: STATUSES.COMPLETED }, fakeReq),
    (error) => {
      assert.strictEqual(error.statusCode, 409);
      assert.match(error.message, /complete endpoint/i);
      return true;
    }
  );
});

test("5. Log progress — first entry moves Open -> InProgress", async () => {
  const first = await WorkOrderService.logProgress(
    workOrderId,
    { note: "Site inspected; bulbs confirmed dead." },
    fakeReq
  );
  assert.strictEqual(first.status, STATUSES.IN_PROGRESS);
  assert.strictEqual(first.progressLog.length, 1);
  assert.strictEqual(first.progressLog[0].author, fakeReq.user._id);
  assert.ok(first.progressLog[0].date);

  const second = await WorkOrderService.logProgress(
    workOrderId,
    { note: "New LED bulbs installed and tested." },
    fakeReq
  );
  assert.strictEqual(second.status, STATUSES.IN_PROGRESS);
  assert.strictEqual(second.progressLog.length, 2);
  assert.match(second.progressLog[1].note, /installed/i);
});

test("6. Mark the work order complete (completion note required)", async () => {
  await assert.rejects(
    () => WorkOrderService.complete(workOrderId, { completionNote: "" }, fakeReq),
    (error) => {
      assert.strictEqual(error.statusCode, 400);
      assert.match(error.message, /Completion note/i);
      return true;
    }
  );
  const completed = await WorkOrderService.complete(
    workOrderId,
    { completionNote: "All three street lights replaced and working." },
    fakeReq
  );
  assert.strictEqual(completed.status, STATUSES.COMPLETED);
  assert.strictEqual(completed.completionNote, "All three street lights replaced and working.");
  assert.ok(completed.completedAt, "completedAt should be set");

  // Completed work orders are frozen
  await assert.rejects(
    () => WorkOrderService.logProgress(workOrderId, { note: "Too late" }, fakeReq),
    (error) => {
      assert.strictEqual(error.statusCode, 409);
      return true;
    }
  );
  await assert.rejects(
    () => WorkOrderService.cancel(workOrderId, { reason: "changed mind" }, fakeReq),
    (error) => {
      assert.strictEqual(error.statusCode, 409);
      assert.match(error.message, /Invalid status transition/i);
      return true;
    }
  );
});

test("7. The work order appears in the asset's maintenance history", async () => {
  const history = await AssetService.history(assetId);
  assert.strictEqual(history.asset._id, assetId);
  assert.strictEqual(history.summary.total, 1);
  assert.strictEqual(history.summary.byStatus[STATUSES.COMPLETED], 1);
  assert.strictEqual(history.summary.open, 0);
  assert.strictEqual(history.summary.totalCost, 9500);

  const [entry] = history.workOrders;
  assert.strictEqual(entry._id, workOrderId);
  assert.strictEqual(entry.relatedComplaint, complaintId);
  assert.strictEqual(entry.status, STATUSES.COMPLETED);
  assert.strictEqual(entry.progressLog.length, 2);
  assert.ok(entry.completedAt);

  // Work order is also discoverable from the complaint side
  const linked = await WorkOrderService.list({ relatedComplaint: complaintId });
  assert.strictEqual(linked.pagination.total, 1);
  assert.strictEqual(linked.data[0]._id, workOrderId);
});