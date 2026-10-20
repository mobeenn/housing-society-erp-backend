/**
 * P0-5: Duplicate CNIC is rejected with 409 on create and edit.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { connectDB, db } = require("../src/config/db");
const MemberService = require("../src/modules/members/service");
const Member = require("../src/modules/members/member.model");
const ApiError = require("../src/utils/ApiError");

const stamp = Date.now();
const CNIC_A = "11111-1111111-1";
const CNIC_B = "22222-2222222-2";
const userId = `cnic-test-user-${stamp}`;
const createdIds = [];

before(async () => {
  await connectDB();
});

after(async () => {
  for (const id of createdIds) {
    await db.collection(Member.collectionName).deleteOne({ _id: id });
  }
  await db.collection("auditLogs").deleteMany({ userId });
});

test("createMember rejects a duplicate CNIC with 409", async () => {
  const first = await MemberService.createMember(
    {
      name: `CNIC First ${stamp}`,
      cnic: CNIC_A,
      phone: "03001111111",
      status: "Active",
    },
    userId,
  );
  createdIds.push(first.member._id);

  await assert.rejects(
    () =>
      MemberService.createMember(
        {
          name: `CNIC Second ${stamp}`,
          cnic: CNIC_A,
          phone: "03002222222",
          status: "Active",
        },
        userId,
      ),
    (err) => err instanceof ApiError && err.statusCode === 409 && /CNIC/i.test(err.message) && err.message.includes(first.member.memberId),
  );
});

test("updateMember rejects changing CNIC to one used by another member", async () => {
  const other = await MemberService.createMember(
    {
      name: `CNIC Other ${stamp}`,
      cnic: CNIC_B,
      phone: "03003333333",
      status: "Active",
    },
    userId,
  );
  createdIds.push(other.member._id);

  const target = await MemberService.createMember(
    {
      name: `CNIC Target ${stamp}`,
      cnic: "33333-3333333-3",
      phone: "03004444444",
      status: "Active",
    },
    userId,
  );
  createdIds.push(target.member._id);

  await assert.rejects(
    () =>
      MemberService.updateMember(
        target.member._id,
        { cnic: CNIC_B },
        userId,
      ),
    (err) => err instanceof ApiError && err.statusCode === 409 && /CNIC/i.test(err.message),
  );
});

test("duplicate phone alone does not block create", async () => {
  const created = await MemberService.createMember(
    {
      name: `CNIC Phone Dup ${stamp}`,
      cnic: "44444-4444444-4",
      phone: "03001111111", // same as first member
      status: "Active",
    },
    userId,
  );
  createdIds.push(created.member._id);
  assert.ok(created.member._id);
  assert.equal(created.duplicateWarning?.hasDuplicates, true);
});
