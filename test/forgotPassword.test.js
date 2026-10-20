/**
 * P5-1: Forgot / reset password behaviour.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const AuthService = require("../src/modules/auth/service");
const { prisma } = require("../src/config/prisma");

function stub(obj, key, impl) {
  const previous = obj[key];
  obj[key] = impl;
  return () => {
    obj[key] = previous;
  };
}

describe("forgot / reset password", () => {
  test("forgotPassword always returns the same generic message", async () => {
    const restoreFind = stub(prisma.user, "findUnique", async () => null);
    const missing = await AuthService.forgotPassword("nobody@example.com");
    assert.match(missing.message, /If an account exists/i);
    restoreFind();

    let created = false;
    const restoreFind2 = stub(prisma.user, "findUnique", async () => ({
      id: "u1",
      email: "a@example.com",
      isActive: true,
      passwordHash: "hash",
    }));
    const restoreCreate = stub(prisma.passwordResetToken, "create", async () => {
      created = true;
      return { id: "t1" };
    });
    const exists = await AuthService.forgotPassword("a@example.com");
    assert.equal(exists.message, missing.message);
    assert.equal(created, true);
    restoreFind2();
    restoreCreate();
  });

  test("resetPassword rejects expired token", async () => {
    const token = "abc123";
    const restore = stub(prisma.passwordResetToken, "findFirst", async () => ({
      id: "t1",
      userId: "u1",
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    }));

    await assert.rejects(
      () => AuthService.resetPassword(token, "newpassword1"),
      (err) => Number(err.statusCode) === 400
    );
    restore();
  });

  test("resetPassword rejects used token", async () => {
    const token = "abc123";
    const restore = stub(prisma.passwordResetToken, "findFirst", async () => ({
      id: "t1",
      userId: "u1",
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }));

    await assert.rejects(
      () => AuthService.resetPassword(token, "newpassword1"),
      (err) => Number(err.statusCode) === 400
    );
    restore();
  });
});
