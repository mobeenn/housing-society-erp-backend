/**
 * SRS Section 19 - Visitor & Pass Management end-to-end flow test.
 * 1. Create a host member and guard user
 * 2. Issue passes (Contractor, Temporary, Visitor)
 * 3. Log visitor entry
 * 4. Verify visitor is in active list
 * 5. Mark visitor exit and verify active list reflects it
 * 6. Search history by name and vehicle
 * 7. Test blacklist enforcement (Warn vs Block)
 * 8. Test pass verification on entry (valid, expired, revoked)
 * 9. Deactivate blacklist entry and verify subsequent entry allowed
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert");

const { connectDB, db } = require("../src/config/db");
const { VisitorEntryService, PassService, BlacklistService } = require("../src/modules/visitors/service");
const Member = require("../src/modules/members/member.model");
const User = require("../src/modules/auth/user.model");

const fakeReq = {
  user: { _id: "test-guard-user-001" },
  ip: "127.0.0.1",
  headers: { "user-agent": "visitor-flow-test" },
};

let memberId;
let guardUserId;
let passId;
let expiredPassId;
let entryId;
let blockBlacklistId;
let warnBlacklistId;

const cleanup = async () => {
  if (memberId) {
    await db.collection(Member.collectionName).deleteOne({ _id: memberId });
  }
  if (guardUserId) {
    await db.collection("users").deleteOne({ _id: guardUserId });
  }
  if (passId) {
    await db.collection("passes").deleteOne({ _id: passId });
  }
  if (expiredPassId) {
    await db.collection("passes").deleteOne({ _id: expiredPassId });
  }
  if (entryId) {
    await db.collection("visitorEntries").deleteOne({ _id: entryId });
  }
  if (blockBlacklistId) {
    await db.collection("blacklist").deleteOne({ _id: blockBlacklistId });
  }
  if (warnBlacklistId) {
    await db.collection("blacklist").deleteOne({ _id: warnBlacklistId });
  }
  await db.collection("passes").deleteMany({ passNumber: { $in: ["PASS-2024-001", "PASS-EXP-001", "PASS-TEST-001"] } });
  await db.collection("blacklist").deleteMany({ name: { $in: ["Blocked Visitor", "Warning Visitor"] } });
  await db.collection("visitorEntries").deleteMany({ visitorName: { $in: ["Sara Malik", "Blocked Visitor", "Warning Visitor", "Ahmed Plumber", "Expired User"] } });
  await db.collection("auditLogs").deleteMany({ userId: fakeReq.user._id });
};

test("Visitor & Pass Management Flow", async (t) => {
  before(async () => {
    await connectDB();
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  await t.test("1. Create test host member and guard user", async () => {
    const member = await Member.create(
      {
        name: "Ali Khan",
        membershipNumber: "M-VIS-001",
        cnic: "12345-1234567-1",
        contactNumber: "03001234567",
        email: "ali.khan.visitor.test@example.com",
        status: "Active",
      },
      fakeReq.user._id
    );
    assert.ok(member._id, "Member should be created with an ID");
    memberId = member._id;

    const guard = await User.create({
      name: "Guard Hassan",
      email: "guard001.test@society.com",
      phone: "03007654321",
      roles: ["guard"],
      isActive: true,
      createdBy: fakeReq.user._id,
    });
    assert.ok(guard._id || guard.insertedId, "Guard user should be created");
    guardUserId = guard._id || guard.insertedId;
  });

  await t.test("2. Issue a pass for a contractor", async () => {
    const pass = await PassService.create(
      {
        passNumber: "PASS-2024-001",
        type: "Contractor",
        holderName: "Ahmed Plumber",
        phone: "03009876543",
        cnic: "54321-7654321-2",
        validFrom: "2024-01-01",
        validTo: "2029-12-31",
        relatedMember: memberId,
        purpose: "Plumbing maintenance",
        notes: "Society approved contractor",
      },
      fakeReq
    );

    assert.ok(pass._id, "Pass should be created with an ID");
    assert.strictEqual(pass.passNumber, "PASS-2024-001");
    assert.strictEqual(pass.type, "Contractor");
    assert.strictEqual(pass.status, "Active");
    passId = pass._id;
  });

  await t.test("3. Log a standard visitor entry", async () => {
    const entry = await VisitorEntryService.create(
      {
        visitorName: "Sara Malik",
        phone: "03111234567",
        cnic: "11111-2222222-3",
        hostMember: memberId,
        purpose: "Personal visit",
        gate: "Main Gate",
        vehicleNumber: "ABC-123",
        remarks: "Guest of Ali Khan",
      },
      fakeReq
    );

    assert.ok(entry._id, "Visitor entry should be created");
    assert.strictEqual(entry.visitorName, "Sara Malik");
    assert.strictEqual(entry.vehicleNumber, "ABC-123");
    assert.ok(entry.entryTime, "Entry time should be recorded");
    assert.strictEqual(entry.exitTime, null, "Exit time should be null initially");
    assert.ok(!entry.blacklistWarning, "No blacklist warning should be present");
    entryId = entry._id;
  });

  await t.test("4. Visitor should appear in active visitors list", async () => {
    const result = await VisitorEntryService.list({ activeOnly: true });
    assert.ok(result.data, "Should return data array");
    const found = result.data.find((v) => v._id === entryId);
    assert.ok(found, "Sara Malik entry should be in active visitors");
    assert.strictEqual(found.exitTime, null, "Exit time should still be null");
  });

  await t.test("5. Mark exit for the visitor", async () => {
    const updated = await VisitorEntryService.markExit(
      entryId,
      { remarks: "Left via Main Gate" },
      fakeReq
    );

    assert.ok(updated.exitTime, "Exit time should be set");
    assert.strictEqual(updated.remarks, "Left via Main Gate");
  });

  await t.test("6. Visitor should no longer appear in active visitors list", async () => {
    const result = await VisitorEntryService.list({ activeOnly: true });
    const found = result.data.find((v) => v._id === entryId);
    assert.ok(!found, "Visitor should not be in active list after exit");
  });

  await t.test("7. Search visitor history by visitor name and vehicle", async () => {
    const nameSearch = await VisitorEntryService.list({ q: "Sara" });
    assert.ok(nameSearch.data.some((v) => v._id === entryId), "Found by name search");

    const vehicleSearch = await VisitorEntryService.list({ q: "ABC-123" });
    assert.ok(vehicleSearch.data.some((v) => v._id === entryId), "Found by vehicle search");
  });

  await t.test("8. Add person to blacklist with Block action", async () => {
    const bl = await BlacklistService.create(
      {
        name: "Blocked Visitor",
        cnic: "99999-9999999-9",
        phone: "03001111111",
        vehicleNumber: "XYZ-999",
        reason: "Security incident",
        action: "Block",
      },
      fakeReq
    );

    assert.ok(bl._id, "Blacklist entry should be created");
    assert.strictEqual(bl.action, "Block");
    assert.strictEqual(bl.status, "Active");
    blockBlacklistId = bl._id;
  });

  await t.test("9. Entry should be blocked when matching a Block blacklist rule", async () => {
    await assert.rejects(
      async () => {
        await VisitorEntryService.create(
          {
            visitorName: "Blocked Visitor",
            cnic: "99999-9999999-9",
            hostMember: memberId,
            purpose: "Attempting entry",
            gate: "Main Gate",
          },
          fakeReq
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.ok(err.message.includes("blacklisted"), "Error should mention blacklisted");
        return true;
      }
    );
  });

  await t.test("10. Entry should succeed with warning when matching a Warn blacklist rule", async () => {
    const bl = await BlacklistService.create(
      {
        name: "Warning Visitor",
        phone: "03002222222",
        reason: "Previous noise complaint",
        action: "Warn",
      },
      fakeReq
    );
    warnBlacklistId = bl._id;

    const entry = await VisitorEntryService.create(
      {
        visitorName: "Warning Visitor",
        phone: "03002222222",
        hostMember: memberId,
        purpose: "Visiting resident",
        gate: "Main Gate",
      },
      fakeReq
    );

    assert.ok(entry._id, "Entry should be logged");
    assert.ok(entry.blacklistWarning, "Blacklist warning should be returned");
    assert.ok(entry.blacklistWarning.includes("Blacklisted"), "Warning should detail blacklist rule");
  });

  await t.test("11. Entry using a valid pass should succeed and enrich pass reference", async () => {
    const entry = await VisitorEntryService.create(
      {
        visitorName: "Ahmed Plumber",
        phone: "03009876543",
        purpose: "Contractor plumbing work",
        gate: "Service Gate",
        passId: passId,
      },
      fakeReq
    );

    assert.ok(entry._id, "Entry should be created");
    assert.strictEqual(entry.passId, passId);
    assert.ok(entry.passRef, "Pass details should be populated");
    assert.strictEqual(entry.passRef.passNumber, "PASS-2024-001");
  });

  await t.test("12. Expired pass should be rejected on entry attempt", async () => {
    const expPass = await PassService.create(
      {
        passNumber: "PASS-EXP-001",
        type: "Temporary",
        holderName: "Expired User",
        validFrom: "2022-01-01",
        validTo: "2022-12-31",
        purpose: "Expired pass test",
      },
      fakeReq
    );
    expiredPassId = expPass._id;

    await assert.rejects(
      async () => {
        await VisitorEntryService.create(
          {
            visitorName: "Expired User",
            purpose: "Attempt entry",
            gate: "Main Gate",
            passId: expPass._id,
          },
          fakeReq
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes("expired"), "Error should indicate pass expired");
        return true;
      }
    );
  });

  await t.test("13. Revoking a pass prevents future entries", async () => {
    await PassService.update(passId, { status: "Revoked", notes: "Contract finished" }, fakeReq);

    await assert.rejects(
      async () => {
        await VisitorEntryService.create(
          {
            visitorName: "Ahmed Plumber",
            purpose: "Work attempt",
            gate: "Main Gate",
            passId: passId,
          },
          fakeReq
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes("not active"), "Error should indicate pass is not active");
        return true;
      }
    );
  });

  await t.test("14. Deactivating blacklist entry allows unrestricted entry", async () => {
    await BlacklistService.update(warnBlacklistId, { status: "Inactive" }, fakeReq);

    const entry = await VisitorEntryService.create(
      {
        visitorName: "Warning Visitor",
        phone: "03002222222",
        hostMember: memberId,
        purpose: "Follow-up visit",
        gate: "Main Gate",
      },
      fakeReq
    );

    assert.ok(entry._id, "Entry should succeed");
    assert.strictEqual(entry.blacklistWarning, undefined, "No blacklist warning when rule is Inactive");
  });
});
