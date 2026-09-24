const assert = require("node:assert/strict");
const test = require("node:test");
const { allocatePayment, calculatePenalty } = require("../src/modules/payments/allocationCalculator");

const installment = (overrides = {}) => ({ _id: "installment-1", amount: 1000, paidAmount: 0, balance: 1000, penaltyAmount: 0, discountAmount: 0, dueDate: "2026-01-01T00:00:00.000Z", ...overrides });
const noPenalty = { type: "flat", amount: 0, period: "day", graceDays: 0 };

test("allocates an exact payment and marks the installment paid", () => {
  const result = allocatePayment({ installments: [installment()], paymentAmount: 1000, penaltyRule: noPenalty, now: new Date("2026-01-02T00:00:00.000Z") });
  assert.equal(result.allocations[0].amountApplied, 1000);
  assert.equal(result.updates[0].balance, 0);
  assert.equal(result.updates[0].status, "Paid");
});

test("allocates partial payment without skipping the oldest installment", () => {
  const result = allocatePayment({ installments: [installment({ _id: "old" }), installment({ _id: "new", dueDate: "2026-02-01T00:00:00.000Z" })], paymentAmount: 250, penaltyRule: noPenalty, now: new Date("2026-01-02T00:00:00.000Z") });
  assert.deepEqual(result.allocations, [{ installment: "old", amountApplied: 250 }]);
  assert.equal(result.updates[0].status, "PartiallyPaid");
});

test("rejects overpayment", () => {
  assert.throws(() => allocatePayment({ installments: [installment()], paymentAmount: 1001, penaltyRule: noPenalty }), /exceeds outstanding balance/);
});

test("calculates percentage penalty after discount override", () => {
  assert.equal(calculatePenalty({ balance: 1000, discountAmount: 100, overdueDays: 10, rule: { type: "percentage", amount: 1, period: "day", graceDays: 0 } }), 90);
});