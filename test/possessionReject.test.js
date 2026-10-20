/**
 * P1-6: Possession reject sets Rejected and blocks later approve.
 */
const { test, before } = require("node:test");
const assert = require("node:assert");

const PossessionService = require("../src/modules/possession/service");
const PossessionApplication = require("../src/modules/possession/possession.model");
const { connectDB, db } = require("../src/config/db");

const fakeReq = { user: { _id: "test-user-possession" }, ip: "127.0.0.1", headers: {} };

before(async () => {
  await connectDB();
});

test("reject requires reason and blocks approve", async () => {
  const existing = (await PossessionApplication.find({}, { limit: 5 })).find(
    (row) => row.status !== PossessionApplication.STATUS.POSSESSED
  );
  assert.ok(existing, "seeded possession application required");

  await assert.rejects(
    () => PossessionService.reject(existing._id, "   ", fakeReq),
    (err) => err.statusCode === 400
  );

  await PossessionApplication.update(existing._id, {
    status: PossessionApplication.STATUS.UNDER_VERIFICATION,
  });

  const rejected = await PossessionService.reject(existing._id, "Documents incomplete", fakeReq);
  assert.equal(rejected.status, PossessionApplication.STATUS.REJECTED);

  await assert.rejects(
    () => PossessionService.approve(existing._id, fakeReq),
    (err) => err.statusCode === 409
  );

  // restore for other suites
  await db.collection(PossessionApplication.collectionName).updateOne(
    { _id: existing._id },
    { status: existing.status, approvalStages: existing.approvalStages }
  );
});
