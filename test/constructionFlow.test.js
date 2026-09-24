/**
 * SRS Section 15 - Construction module end-to-end flow test.
 * 1. Submit application (plot -> Under Construction)
 * 2. Start review
 * 3. Log inspection WITH violation
 * 4. Approval blocked while violation open
 * 5. Mark corrective action done
 * 6. Re-inspect clean
 * 7. Approve -> completion certificate + plot -> Constructed
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert");

const { connectDB, db } = require("../src/config/db");
const ConstructionService = require("../src/modules/construction/service");
const { ConstructionApplication, SiteInspection } = require("../src/modules/construction/construction.model");
const { Plot } = require("../src/modules/properties/plot.model");
const Member = require("../src/modules/members/member.model");

const fakeReq = {
  user: { _id: "test-construction-user" },
  ip: "127.0.0.1",
  headers: { "user-agent": "construction-flow-test" },
};

let memberId;
let plotId;
let applicationId;
let firstInspectionId;

const cleanup = async () => {
  if (applicationId) {
    await db.collection(ConstructionApplication.collectionName).deleteOne({ _id: applicationId });
    await db.collection(SiteInspection.collectionName).deleteMany({ application: applicationId });
    await db.collection("auditLogs").deleteMany({ entityId: applicationId });
  }
  await db.collection("siteInspections").deleteMany({ inspectorUser: fakeReq.user._id });
  await db.collection("auditLogs").deleteMany({ userId: fakeReq.user._id });
  if (memberId) await db.collection(Member.collectionName).deleteOne({ _id: memberId });
  if (plotId) await db.collection(Plot.collectionName).deleteOne({ _id: plotId });
};

before(async () => {
  await connectDB();
  const member = await db.collection(Member.collectionName).insertOne({
    memberId: "TEST-CON-MEMBER",
    name: "Construction Flow Member",
    cnic: "0000000000000",
    status: Member.STATUS.ACTIVE,
  });
  memberId = member._id;
  const plot = await db.collection(Plot.collectionName).insertOne({
    plotNumber: "TEST-CON-PLOT-01",
    block: "T",
    street: "1",
    size: "500",
    category: "residential",
    propertyType: "residential",
    currentOwner: memberId,
    status: Plot.STATUS.ALLOTTED,
    price: 1000000,
  });
  plotId = plot._id;
});

after(async () => {
  await cleanup();
});

test("1. Submit construction application moves plot to Under Construction", async () => {
  const application = await ConstructionService.create(
    { member: memberId, plot: plotId, applicationType: "Construction", documents: [], fees: 5000 },
    fakeReq
  );
  applicationId = application._id;
  assert.strictEqual(application.status, "Applied");
  assert.strictEqual(application.reviewStatus, "Pending");
  assert.strictEqual(application.fees, 5000);
  assert.deepStrictEqual(application.documents, []);
  const plot = await Plot.findById(plotId);
  assert.strictEqual(plot.status, Plot.STATUS.UNDER_CONSTRUCTION);
});

test("2. Start review moves application to UnderReview", async () => {
  const application = await ConstructionService.review(applicationId, fakeReq);
  assert.strictEqual(application.status, "UnderReview");
  assert.strictEqual(application.reviewStatus, "UnderReview");
});

test("3. Log inspection with a violation", async () => {
  const application = await ConstructionService.addInspection(
    applicationId,
    {
      date: new Date().toISOString(),
      findings: "Foundation works inspected. Deviation found from approved plan.",
      violations: ["Boundary wall exceeds sanctioned height by 10%"],
      correctiveActionsRequired: true,
      reinspectionRequired: true,
      reinspectionDate: "2026-10-01",
    },
    fakeReq
  );
  assert.strictEqual(application.inspections.length, 1);
  const inspection = application.inspections[0];
  firstInspectionId = inspection._id;
  assert.strictEqual(inspection.inspectorUser, fakeReq.user._id);
  assert.strictEqual(inspection.violations.length, 1);
  assert.strictEqual(inspection.correctiveActionsRequired, true);
  assert.strictEqual(inspection.reinspectionRequired, true);
});

test("4. Approval blocked while a violation is open", async () => {
  await assert.rejects(
    () => ConstructionService.approve(applicationId, fakeReq),
    (error) => {
      assert.strictEqual(error.statusCode, 409);
      assert.match(error.message, /inspections must pass/i);
      return true;
    }
  );
});

test("5. Mark corrective action done clears the violation", async () => {
  await ConstructionService.updateInspection(
    firstInspectionId,
    { correctiveActionsRequired: false, reinspectionRequired: false, violations: [] },
    fakeReq
  );
  const inspection = await SiteInspection.findById(firstInspectionId);
  assert.strictEqual(inspection.correctiveActionsRequired, false);
  assert.strictEqual(inspection.reinspectionRequired, false);
  assert.deepStrictEqual(inspection.violations, []);
});

test("6. Re-inspection passes cleanly", async () => {
  const application = await ConstructionService.addInspection(
    applicationId,
    {
      date: new Date().toISOString(),
      findings: "Re-inspection: boundary wall lowered to sanctioned height. All clear.",
      violations: [],
      correctiveActionsRequired: false,
      reinspectionRequired: false,
    },
    fakeReq
  );
  assert.strictEqual(application.inspections.length, 2);
  const latest = application.inspections[application.inspections.length - 1];
  assert.deepStrictEqual(latest.violations, []);
  assert.strictEqual(latest.correctiveActionsRequired, false);
});

test("7. Approve generates completion certificate and marks plot Constructed", async () => {
  const application = await ConstructionService.approve(applicationId, fakeReq);
  assert.strictEqual(application.status, "Approved");
  assert.strictEqual(application.reviewStatus, "Approved");
  assert.strictEqual(
    application.completionCertificateUrl,
    `/api/construction/${applicationId}/completion-certificate.pdf`
  );
  const plot = await Plot.findById(plotId);
  assert.strictEqual(plot.status, Plot.STATUS.CONSTRUCTED);
  const { buffer } = await ConstructionService.certificate(applicationId);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0, "Certificate PDF buffer should not be empty");
  assert.strictEqual(buffer.subarray(0, 5).toString(), "%PDF-");
});
