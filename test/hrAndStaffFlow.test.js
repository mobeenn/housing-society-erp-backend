/**
 * SRS Section 20 - HR & Staff Management end-to-end flow test.
 * 1. Create a linked system user and employee
 * 2. Update employee profile
 * 3. Mark single and bulk attendance
 * 4. Query attendance records
 * 5. Check initial leave balance
 * 6. Submit leave request and verify balance snapshot
 * 7. Approve leave request and verify balance updates
 * 8. Reject leave request exceeding available balance
 * 9. Test duplicate attendance prevention
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert");

const { connectDB, db } = require("../src/config/db");
const { EmployeeService, AttendanceService, LeaveRequestService } = require("../src/modules/hr/service");
const Employee = require("../src/modules/hr/employee.model");
const Attendance = require("../src/modules/hr/attendance.model");
const LeaveRequest = require("../src/modules/hr/leaveRequest.model");
const User = require("../src/modules/auth/user.model");

const fakeReq = {
  user: { _id: "test-hr-officer-001" },
  ip: "127.0.0.1",
  headers: { "user-agent": "hr-flow-test" },
};

let linkedUserId;
let employeeId;
let employee2Id;
let attendanceId;
let leaveRequestId;

const cleanup = async () => {
  if (employeeId) {
    await db.collection("employees").deleteOne({ _id: employeeId });
  }
  if (employee2Id) {
    await db.collection("employees").deleteOne({ _id: employee2Id });
  }
  if (linkedUserId) {
    await db.collection("users").deleteOne({ _id: linkedUserId });
  }
  if (attendanceId) {
    await db.collection("attendance").deleteOne({ _id: attendanceId });
  }
  if (leaveRequestId) {
    await db.collection("leaveRequests").deleteOne({ _id: leaveRequestId });
  }

  await db.collection("employees").deleteMany({ employeeId: { $in: ["EMP-2024-001", "EMP-2024-002"] } });
  await db.collection("attendance").deleteMany({ employee: { $in: [employeeId, employee2Id] } });
  await db.collection("leaveRequests").deleteMany({ employee: { $in: [employeeId, employee2Id] } });
  await db.collection("auditLogs").deleteMany({ userId: fakeReq.user._id });
};

test("HR & Staff Management Flow", async (t) => {
  before(async () => {
    await connectDB();
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  await t.test("1. Create system user and employee with linked user", async () => {
    // Create system user
    const user = await User.create({
      name: "Tariq Mahmood",
      email: "tariq.staff.test@society.com",
      phone: "03001122334",
      roles: ["staff"],
      isActive: true,
      createdBy: fakeReq.user._id,
    });
    linkedUserId = user._id || user.insertedId;
    assert.ok(linkedUserId, "User should be created");

    // Create employee linked to user
    const employee = await EmployeeService.create(
      {
        employeeId: "EMP-2024-001",
        name: "Tariq Mahmood",
        cnic: "35201-1234567-1",
        phone: "03001122334",
        email: "tariq.staff.test@society.com",
        department: "Maintenance",
        designation: "Senior Electrician",
        joiningDate: "2024-01-15",
        linkedUser: linkedUserId,
        basicSalary: 65000,
        status: "Active",
      },
      fakeReq
    );

    assert.ok(employee._id, "Employee should be created with an ID");
    assert.strictEqual(employee.employeeId, "EMP-2024-001");
    assert.strictEqual(employee.linkedUser, linkedUserId);
    assert.ok(employee.linkedUserRef, "Linked user reference should be populated");
    assert.strictEqual(employee.linkedUserRef.email, "tariq.staff.test@society.com");
    employeeId = employee._id;
  });

  await t.test("2. Create second employee without linked user", async () => {
    const employee = await EmployeeService.create(
      {
        employeeId: "EMP-2024-002",
        name: "Rashid Ali",
        cnic: "35201-9876543-2",
        phone: "03005544332",
        department: "Security",
        designation: "Security Supervisor",
        joiningDate: "2024-02-01",
        status: "Active",
      },
      fakeReq
    );

    assert.ok(employee._id, "Employee without linked user should be created");
    assert.strictEqual(employee.linkedUser, null);
    employee2Id = employee._id;
  });

  await t.test("3. Reject duplicate employeeId", async () => {
    await assert.rejects(
      async () => {
        await EmployeeService.create(
          {
            employeeId: "EMP-2024-001",
            name: "Duplicate Emp",
            department: "HR",
            designation: "Officer",
            joiningDate: "2024-03-01",
          },
          fakeReq
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes("already exists"));
        return true;
      }
    );
  });

  await t.test("4. Update employee details", async () => {
    const updated = await EmployeeService.update(
      employeeId,
      {
        designation: "Lead Electrician",
        basicSalary: 75000,
        remarks: "Promoted after probation",
      },
      fakeReq
    );

    assert.strictEqual(updated.designation, "Lead Electrician");
    assert.strictEqual(updated.basicSalary, 75000);
    assert.strictEqual(updated.remarks, "Promoted after probation");
  });

  await t.test("5. Mark single attendance record", async () => {
    const att = await AttendanceService.create(
      {
        employee: employeeId,
        date: "2024-09-01",
        status: "Present",
        checkIn: "08:55",
        checkOut: "17:05",
        remarks: "On time",
      },
      fakeReq
    );

    assert.ok(att._id, "Attendance record created");
    assert.strictEqual(att.status, "Present");
    assert.ok(att.employeeRef, "Employee reference enriched");
    assert.strictEqual(att.employeeRef.name, "Tariq Mahmood");
    attendanceId = att._id;
  });

  await t.test("6. Prevent duplicate attendance on same date", async () => {
    await assert.rejects(
      async () => {
        await AttendanceService.create(
          {
            employee: employeeId,
            date: "2024-09-01",
            status: "Present",
          },
          fakeReq
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes("already marked"));
        return true;
      }
    );
  });

  await t.test("7. Mark bulk attendance for team", async () => {
    const records = [
      {
        employee: employeeId,
        date: "2024-09-02",
        status: "Present",
        checkIn: "09:00",
        checkOut: "17:00",
      },
      {
        employee: employee2Id,
        date: "2024-09-02",
        status: "Present",
        checkIn: "08:45",
        checkOut: "17:15",
      },
    ];

    const result = await AttendanceService.bulkCreate(records, fakeReq);
    assert.strictEqual(result.count, 2);
    assert.strictEqual(result.data.length, 2);
  });

  await t.test("8. Query attendance by employee and date range", async () => {
    const list = await AttendanceService.list({
      employee: employeeId,
      from: "2024-09-01",
      to: "2024-09-30",
    });

    assert.strictEqual(list.data.length, 2);
    assert.ok(list.data.every((r) => r.employee === employeeId));
  });

  await t.test("9. Check initial leave balance", async () => {
    const balance = await LeaveRequestService.calculateLeaveBalance(employeeId);
    assert.ok(balance.Annual, "Annual leave balance should exist");
    assert.strictEqual(balance.Annual.total, 20);
    assert.strictEqual(balance.Annual.used, 0);
    assert.strictEqual(balance.Annual.available, 20);

    assert.ok(balance.Sick, "Sick leave balance should exist");
    assert.strictEqual(balance.Sick.total, 10);
    assert.strictEqual(balance.Sick.used, 0);
    assert.strictEqual(balance.Sick.available, 10);
  });

  await t.test("10. Submit leave request and verify balance snapshot", async () => {
    const currentYear = new Date().getFullYear();
    const req = await LeaveRequestService.create(
      {
        employee: employeeId,
        type: "Annual",
        fromDate: `${currentYear}-10-01`,
        toDate: `${currentYear}-10-03`, // 3 days
        reason: "Family vacation",
      },
      fakeReq
    );

    assert.ok(req._id, "Leave request should be created");
    assert.strictEqual(req.status, "Pending");
    assert.ok(req.balanceSnapshot, "Balance snapshot should be captured");
    assert.strictEqual(req.balanceSnapshot.available, 20);
    leaveRequestId = req._id;
  });

  await t.test("11. Approve leave request and verify updated balance", async () => {
    const approved = await LeaveRequestService.update(
      leaveRequestId,
      { status: "Approved" },
      fakeReq
    );

    assert.strictEqual(approved.status, "Approved");
    assert.strictEqual(approved.approvedBy, fakeReq.user._id);
    assert.ok(approved.approvedAt, "Approval timestamp should be set");

    // Check calculated balance after approval
    const balance = await LeaveRequestService.calculateLeaveBalance(employeeId);
    assert.strictEqual(balance.Annual.used, 3, "Used annual leaves should be 3 days");
    assert.strictEqual(balance.Annual.available, 17, "Available annual leaves should be 17 days");
  });

  await t.test("12. Reject leave request exceeding available balance", async () => {
    const currentYear = new Date().getFullYear();
    await assert.rejects(
      async () => {
        await LeaveRequestService.create(
          {
            employee: employeeId,
            type: "Sick",
            fromDate: `${currentYear}-11-01`,
            toDate: `${currentYear}-11-15`, // 15 days, Sick allowance is 10
            reason: "Medical procedure",
          },
          fakeReq
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes("Insufficient leave balance"));
        return true;
      }
    );
  });
});
