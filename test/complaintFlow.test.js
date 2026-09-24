/**
 * SRS Section 16 - Complaints module end-to-end flow test.
 * 1. File a complaint (auto-assign default department + SLA due date)
 * 2. Invalid status transition rejected (validates allowed transitions)
 * 3. Assign to staff (New -> Assigned)
 * 4. Add a progress comment
 * 5. Start work (Assigned -> InProgress)
 * 6. Resolve (requires resolution note)
 * 7. Reopen a resolved complaint
 * 8. Re-resolve after reopen
 * 9. Complaints report reflects the complaint (open/overdue/by-category/by-department/avg-resolution-time)
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert");

const { connectDB, db } = require("../src/config/db");
const ComplaintService = require("../src/modules/complaints/service");
const { Complaint } = require("../src/modules/complaints/complaint.model");
const { STATUSES, getPrioritySlaHours } = require("../src/modules/complaints/complaint.config");
const { ReportService } = require("../src/modules/reports/service");
const { Department } = require("../src/modules/administration/masterData.model");
const Member = require("../src/modules/members/member.model");

const fakeReq = {
  user: { _id: "test-complaint-user" },
  ip: "127.0.0.1",
  headers: { "user-agent": "complaint-flow-test" },
};

const CATEGORY = "Sanitation";
const PRIORITY = "Medium";

let memberId;
let staffId;
let departmentId;
let createdDepartment = false;
let complaintId;

const cleanup = async () => {
  if (complaintId) {
    await db.collection(Complaint.collectionName).deleteOne({ _id: complaintId });
    await db.collection("auditLogs").deleteMany({ entityId: complaintId });
  }
  await db.collection("auditLogs").deleteMany({ userId: fakeReq.user._id });
  if (memberId) await db.collection(Member.collectionName).deleteOne({ _id: memberId });
  if (staffId) await db.collection("users").deleteOne({ _id: staffId });
  if (createdDepartment && departmentId) {
    await db.collection(Department.collectionName).deleteOne({ _id: departmentId });
  }
};

before(async () => {
  await connectDB();
  const member = await db.collection(Member.collectionName).insertOne({
    memberId: "TEST-CMP-MEMBER",
    name: "Complaint Flow Member",
    cnic: "0000000000001",
    status: Member.STATUS.ACTIVE,
  });
  memberId = member._id;

  const staff = await db.collection("users").insertOne({
    name: "Complaint Staff",
    email: "complaint-staff@example.test",
    isActive: true,
  });
  staffId = staff._id;

  const existing = (await Department.find({ code: "OPS" }))[0];
  if (existing) {
    departmentId = existing._id;
  } else {
    const created = await db.collection(Department.collectionName).insertOne({
      name: "Test Operations",
      code: "OPS",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    departmentId = created._id;
    createdDepartment = true;
  }
});

after(async () => {
  await cleanup();
});

test("1. File a complaint — SLA computed, default department auto-assigned", async () => {
  const complaint = await ComplaintService.create(
    {
      member: memberId,
      plot: null, // common-area complaint (plot is nullable)
      category: CATEGORY,
      priority: PRIORITY,
      location: "Block B, Street 4",
      description: "Garbage has not been collected for three days.",
      attachments: [],
    },
    fakeReq
  );
  complaintId = complaint._id;
  assert.strictEqual(complaint.status, STATUSES.NEW);
  assert.strictEqual(complaint.category, CATEGORY);
  // Auto-assignment rule: default department per category
  assert.strictEqual(complaint.assignedDepartment, departmentId);
  // SLA computed from category + priority config
  const expectedMs = getPrioritySlaHours(CATEGORY, PRIORITY) * 60 * 60 * 1000;
  const actualMs =
    new Date(complaint.slaDueDate).getTime() - new Date(complaint.createdAt).getTime();
  assert.ok(
    Math.abs(actualMs - expectedMs) < 5000,
    `slaDueDate should be ${expectedMs}ms after createdAt, got ${actualMs}ms`
  );
  assert.strictEqual(complaint.isOverdue, false);
});

test("2. Invalid status transition is rejected", async () => {
  await assert.rejects(
    () => ComplaintService.changeStatus(complaintId, { status: STATUSES.IN_PROGRESS }, fakeReq),
    (error) => {
      assert.strictEqual(error.statusCode, 409);
      assert.match(error.message, /Invalid status transition/i);
      return true;
    }
  );
});

test("3. Assign complaint to staff (New -> Assigned)", async () => {
  const complaint = await ComplaintService.assign(
    complaintId,
    { assignedStaff: staffId },
    fakeReq
  );
  assert.strictEqual(complaint.status, STATUSES.ASSIGNED);
  assert.strictEqual(complaint.assignedStaff, staffId);
  assert.strictEqual(complaint.assignedStaffRef?.name, "Complaint Staff");
});

test("4. Add a progress comment", async () => {
  const complaint = await ComplaintService.addComment(
    complaintId,
    { text: "Team dispatched, cleanup scheduled for tomorrow morning." },
    fakeReq
  );
  assert.strictEqual(complaint.comments.length, 1);
  assert.match(complaint.comments[0].text, /dispatched/i);
  assert.strictEqual(complaint.comments[0].author, fakeReq.user._id);
});

test("5. Start work (Assigned -> InProgress)", async () => {
  const complaint = await ComplaintService.changeStatus(
    complaintId,
    { status: STATUSES.IN_PROGRESS },
    fakeReq
  );
  assert.strictEqual(complaint.status, STATUSES.IN_PROGRESS);
});

test("6. Resolve requires a note, then resolves the complaint", async () => {
  await assert.rejects(
    () => ComplaintService.resolve(complaintId, { resolutionNote: "" }, fakeReq),
    (error) => {
      assert.strictEqual(error.statusCode, 400);
      assert.match(error.message, /Resolution note/i);
      return true;
    }
  );
  const complaint = await ComplaintService.resolve(
    complaintId,
    { resolutionNote: "Garbage cleared and route schedule corrected." },
    fakeReq
  );
  assert.strictEqual(complaint.status, STATUSES.RESOLVED);
  assert.strictEqual(complaint.resolutionNote, "Garbage cleared and route schedule corrected.");
  assert.ok(complaint.resolvedAt, "resolvedAt should be set");
});

test("7. Reopen a resolved complaint", async () => {
  const complaint = await ComplaintService.reopen(complaintId, fakeReq);
  assert.strictEqual(complaint.status, STATUSES.REOPENED);
  assert.strictEqual(complaint.resolvedAt, null);
});

test("8. Re-resolve after reopen (Reopened -> InProgress -> Resolved)", async () => {
  await ComplaintService.changeStatus(complaintId, { status: STATUSES.IN_PROGRESS }, fakeReq);
  const complaint = await ComplaintService.resolve(
    complaintId,
    { resolutionNote: "Issue fixed permanently after member follow-up." },
    fakeReq
  );
  assert.strictEqual(complaint.status, STATUSES.RESOLVED);
  assert.ok(complaint.resolvedAt);
});

test("9. Complaints report reflects the complaint", async () => {
  const report = await ReportService.run("complaints", {});
  assert.strictEqual(report.report, "complaints");

  const totalByCategory = report.data.byCategory.reduce((sum, row) => sum + row.count, 0);
  assert.ok(totalByCategory >= 1, "report should include our complaint");
  const categoryRow = report.data.byCategory.find((row) => row.category === CATEGORY);
  assert.ok(categoryRow && categoryRow.count >= 1, "category breakdown should include Sanitation");

  const departmentRow = report.data.byDepartment.find(
    (row) => row.departmentId === departmentId
  );
  assert.ok(departmentRow, "department breakdown should include the assigned department");
  assert.ok(departmentRow.count >= 1);

  assert.ok(report.data.resolved >= 1, "our complaint should be counted as resolved");
  assert.strictEqual(typeof report.data.avgResolutionTimeHours, "number");
  assert.ok(report.data.avgResolutionTimeHours >= 0);

  const resolvedStatusRow = report.data.byStatus.find(
    (row) => row.status === STATUSES.RESOLVED
  );
  assert.ok(resolvedStatusRow.count >= 1);

  // Open = statuses that are not Resolved/Closed; overdue counts open + past SLA
  assert.ok(report.data.open >= 0);
  assert.ok(report.data.overdue >= 0);
  assert.strictEqual(report.data.open + report.data.resolved, report.data.total - (report.data.byStatus.find((row) => row.status === STATUSES.CLOSED)?.count || 0));
});