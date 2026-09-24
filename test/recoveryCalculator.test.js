const test = require("node:test");
const assert = require("node:assert/strict");
const { daysOverdue, isOverdueInstallment } = require("../src/modules/recovery/service");

const now = new Date("2026-09-24T12:00:00.000Z");

test("recovery calculates overdue days from dueDate instead of stale snapshots", () => {
  const installment = { dueDate: "2026-08-24", balance: 1000, status: "Upcoming", overdueDays: 0 };
  assert.equal(daysOverdue(installment, now), 31);
  assert.equal(isOverdueInstallment(installment, now), true);
});

test("recovery excludes paid or not-yet-due installments", () => {
  assert.equal(isOverdueInstallment({ dueDate: "2026-08-01", balance: 0, status: "Overdue" }, now), false);
  assert.equal(isOverdueInstallment({ dueDate: "2026-10-01", balance: 1000, status: "Upcoming" }, now), false);
});
