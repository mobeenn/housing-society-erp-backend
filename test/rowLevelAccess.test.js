/**
 * P0-6: Notifications ownership, recovery agent scoping, document related-entity ACL.
 */
const { test, before, after, mock } = require("node:test");
const assert = require("node:assert/strict");

const { connectDB, db } = require("../src/config/db");
const NotificationService = require("../src/modules/notifications/service");
const DocumentService = require("../src/modules/documents/service");
const RecoveryService = require("../src/modules/recovery/service");
const RbacService = require("../src/modules/rbac/service");
const ApiError = require("../src/utils/ApiError");

const stamp = Date.now();
const userA = `notif-user-a-${stamp}`;
const userB = `notif-user-b-${stamp}`;
let notificationId;

before(async () => {
  await connectDB();
});

after(async () => {
  if (notificationId) {
    await db.collection("notifications").deleteOne({ _id: notificationId });
  }
  await db.collection("notifications").deleteMany({
    user: { $in: [userA, userB] },
  });
});

test("notifications markRead rejects another user's notification", async () => {
  const created = await NotificationService.createForUser({
    userId: userA,
    title: "Private note",
    message: "Only for user A",
    eventType: "test.row-level",
    eventKey: `row-level-${stamp}`,
  });
  notificationId = created._id;

  await assert.rejects(
    () => NotificationService.markRead(notificationId, userB),
    (err) => err instanceof ApiError && (err.statusCode === 403 || err.statusCode === 404),
  );

  const listed = await NotificationService.listForUser(userB, { limit: 50 });
  assert.ok(!(listed.data || []).some((n) => n._id === notificationId));
});

test("recovery isSupervisor requires create or approve (not mere view/edit)", async () => {
  mock.method(RbacService, "isSuperAdmin", () => false);
  mock.method(RbacService, "isAllowed", async (_user, moduleKey, action) => {
    if (moduleKey !== "recovery") return false;
    return action === "edit" || action === "view";
  });
  assert.equal(await RecoveryService.isSupervisor({ _id: "agent" }), false);

  mock.method(RbacService, "isAllowed", async (_user, moduleKey, action) => {
    return moduleKey === "recovery" && action === "approve";
  });
  assert.equal(await RecoveryService.isSupervisor({ _id: "mgr" }), true);
  mock.restoreAll();
});

test("document download requires view on related entity module", async () => {
  mock.method(RbacService, "isAllowed", async (_user, moduleKey, action) => {
    return moduleKey === "documents" && action === "view";
  });

  await assert.rejects(
    () =>
      DocumentService.assertRelatedEntityAccess(
        { _id: "u1" },
        { relatedEntityType: "member", relatedEntityId: "m1" },
        "view",
      ),
    (err) => err instanceof ApiError && err.statusCode === 403,
  );

  mock.method(RbacService, "isAllowed", async (_user, moduleKey, action) => {
    return moduleKey === "members" && action === "view";
  });
  await DocumentService.assertRelatedEntityAccess(
    { _id: "u1" },
    { relatedEntityType: "member", relatedEntityId: "m1" },
    "view",
  );
  mock.restoreAll();
});
