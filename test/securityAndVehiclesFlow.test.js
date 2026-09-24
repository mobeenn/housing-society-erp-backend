/**
 * SRS Section 18 & 19 - Security Staff & Vehicles end-to-end flow test.
 * 1. Create a guard
 * 2. Assign guard to a shift (duty roster)
 * 3. Mark attendance for the guard
 * 4. Create a member for vehicle registration
 * 5. Register a vehicle for the member
 * 6. Issue a vehicle sticker
 * 7. Update vehicle access status
 * 8. Verify vehicle appears in member's vehicles list
 * 9. Cleanup
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert");

const { connectDB, db } = require("../src/config/db");
const { GuardService, RosterService } = require("../src/modules/security-staff/service");
const { VehicleService } = require("../src/modules/vehicles/service");
const Member = require("../src/modules/members/member.model");
const { VEHICLE_STATUSES } = require("../src/modules/vehicles/vehicles.config");

const fakeReq = {
  user: { _id: "test-security-user" },
  ip: "127.0.0.1",
  headers: { "user-agent": "security-flow-test" },
};

let guardId;
let rosterId;
let memberId;
let vehicleId;

const cleanup = async () => {
  if (rosterId) {
    await db.collection("dutyRoster").deleteOne({ _id: rosterId });
    await db.collection("auditLogs").deleteMany({ entityId: rosterId });
  }
  if (guardId) {
    await db.collection("guards").deleteOne({ _id: guardId });
    await db.collection("auditLogs").deleteMany({ entityId: guardId });
  }
  if (vehicleId) {
    await db.collection("vehicles").deleteOne({ _id: vehicleId });
    await db.collection("auditLogs").deleteMany({ entityId: vehicleId });
  }
  if (memberId) {
    await db.collection(Member.collectionName).deleteOne({ _id: memberId });
  }
  await db.collection("auditLogs").deleteMany({ userId: fakeReq.user._id });
};

before(async () => {
  await connectDB();
  await cleanup();
});

after(async () => {
  await cleanup();
});

test("Security & Vehicles - Full end-to-end flow", async () => {
  // ─────────────────────────────────────────────
  // Step 1: Create a guard
  // ─────────────────────────────────────────────
  const guardData = {
    name: "John Smith",
    phone: "+92-300-1234567",
    cnic: "12345-6789012-3",
    address: "Test Address, Karachi",
    shift: "Day",
    status: "Active",
  };

  const guard = await GuardService.create(guardData, fakeReq);
  guardId = guard._id;

  assert.ok(guardId, "Guard should be created with an ID");
  assert.strictEqual(guard.name, "John Smith");
  assert.strictEqual(guard.shift, "Day");
  assert.strictEqual(guard.status, "Active");

  console.log("✓ Step 1: Guard created successfully");

  // ─────────────────────────────────────────────
  // Step 2: Assign guard to a shift (duty roster)
  // ─────────────────────────────────────────────
  const today = new Date();
  const rosterData = {
    guard: guardId,
    date: today.toISOString().split("T")[0],
    shift: "Day",
  };

  const roster = await RosterService.assign(rosterData, fakeReq);
  rosterId = roster._id;

  assert.ok(rosterId, "Roster assignment should have an ID");
  assert.strictEqual(roster.guard, guardId);
  assert.strictEqual(roster.shift, "Day");

  console.log("✓ Step 2: Guard assigned to shift successfully");

  // ─────────────────────────────────────────────
  // Step 3: Mark attendance for the guard
  // ─────────────────────────────────────────────
  const attendanceData = {
    guard: guardId,
    date: today.toISOString().split("T")[0],
    attendanceStatus: "Present",
  };

  const updatedRoster = await RosterService.markAttendance(attendanceData, fakeReq);

  assert.strictEqual(updatedRoster.attendanceStatus, "Present");

  console.log("✓ Step 3: Attendance marked successfully");

  // ─────────────────────────────────────────────
  // Step 4: Create a member for vehicle registration
  // ─────────────────────────────────────────────
  const memberData = {
    membershipNumber: "M-TEST-2026-001",
    fullName: "Ahmed Ali",
    fatherName: "Ali Ahmed",
    cnic: "42101-1234567-8",
    contact: {
      mobile: "+92-321-9876543",
      email: "ahmed@example.com",
    },
    address: {
      current: "Block A, Plot 10, Test Society",
      permanent: "Block A, Plot 10, Test Society",
    },
    status: "Active",
  };

  const member = await db.collection(Member.collectionName).insertOne({
    ...memberData,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  memberId = member.insertedId;

  assert.ok(memberId, "Member should be created with an ID");

  console.log("✓ Step 4: Member created successfully");

  // ─────────────────────────────────────────────
  // Step 5: Register a vehicle for the member
  // ─────────────────────────────────────────────
  const vehicleData = {
    owner: memberId,
    number: "ABC-123",
    type: "Car",
    model: "Toyota Corolla 2020",
    status: "Active",
  };

  const vehicle = await VehicleService.create(vehicleData, fakeReq);
  vehicleId = vehicle._id;

  assert.ok(vehicleId, "Vehicle should be created with an ID");
  assert.strictEqual(vehicle.number, "ABC-123");
  assert.strictEqual(vehicle.type, "Car");
  assert.strictEqual(vehicle.status, "Active");

  console.log("✓ Step 5: Vehicle registered successfully");

  // ─────────────────────────────────────────────
  // Step 6: Issue a vehicle sticker
  // ─────────────────────────────────────────────
  const stickerNumber = "STICKER-2026-001";
  const vehicleWithSticker = await VehicleService.issueSticker(vehicleId, stickerNumber, fakeReq);

  assert.strictEqual(vehicleWithSticker.stickerNumber, stickerNumber);
  assert.ok(vehicleWithSticker.stickerIssuedAt);

  console.log("✓ Step 6: Vehicle sticker issued successfully");

  // ─────────────────────────────────────────────
  // Step 7: Update vehicle access status
  // ─────────────────────────────────────────────
  const blockedVehicle = await VehicleService.updateStatus(vehicleId, "Blocked", fakeReq);

  assert.strictEqual(blockedVehicle.status, "Blocked");

  console.log("✓ Step 7: Vehicle status updated to Blocked");

  // Reactivate for next test
  const activeVehicle = await VehicleService.updateStatus(vehicleId, "Active", fakeReq);
  assert.strictEqual(activeVehicle.status, "Active");

  console.log("✓ Step 7b: Vehicle status updated back to Active");

  // ─────────────────────────────────────────────
  // Step 8: Verify vehicle appears in member's vehicles list
  // ─────────────────────────────────────────────
  const memberVehicles = await VehicleService.list({ owner: memberId.toString() });

  assert.ok(memberVehicles.data.length > 0, "Member should have at least one vehicle");
  assert.strictEqual(memberVehicles.data[0]._id.toString(), vehicleId.toString());
  assert.strictEqual(memberVehicles.data[0].number, "ABC-123");

  console.log("✓ Step 8: Vehicle appears in member's vehicles list");

  // ─────────────────────────────────────────────
  // Additional validation: Duplicate vehicle registration should fail
  // ─────────────────────────────────────────────
  try {
    await VehicleService.create(vehicleData, fakeReq);
    assert.fail("Duplicate vehicle registration should have been rejected");
  } catch (error) {
    assert.strictEqual(error.statusCode, 400);
    assert.ok(error.message.includes("already registered"));
    console.log("✓ Duplicate vehicle registration correctly rejected");
  }

  // ─────────────────────────────────────────────
  // Additional validation: Guard listing and filtering
  // ─────────────────────────────────────────────
  const guardsList = await GuardService.list({ status: "Active" });
  assert.ok(guardsList.data.length > 0, "Should return at least one active guard");

  const foundGuard = guardsList.data.find((g) => g._id.toString() === guardId.toString());
  assert.ok(foundGuard, "Created guard should appear in active guards list");

  console.log("✓ Guard listing and filtering works correctly");

  // ─────────────────────────────────────────────
  // Additional validation: Roster date filtering
  // ─────────────────────────────────────────────
  const todayStr = today.toISOString().split("T")[0];
  const rosterList = await RosterService.list({ from: todayStr, to: todayStr });

  assert.ok(rosterList.data.length > 0, "Should return roster entries for today");

  const foundRoster = rosterList.data.find((r) => r._id.toString() === rosterId.toString());
  assert.ok(foundRoster, "Created roster entry should appear in today's roster");
  assert.strictEqual(foundRoster.attendanceStatus, "Present");

  console.log("✓ Roster date filtering and attendance tracking works correctly");

  console.log("\n✅ All Security & Vehicles flow tests passed!");
});
