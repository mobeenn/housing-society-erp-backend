const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateInstallmentSchedule,
  calculateNetPayable,
} = require("../src/modules/bookings/installmentCalculator");

test("calculates net payable and preserves the installment total after rounding", () => {
  const totalAmount = calculateNetPayable({
    price: 1000,
    discount: 100,
    developmentCharges: 50,
    additionalCharges: 25,
  });
  const schedule = calculateInstallmentSchedule({
    totalAmount,
    bookingAmount: 175,
    numberOfInstallments: 3,
    frequency: "monthly",
    firstDueDate: "2026-10-01T00:00:00.000Z",
  });

  assert.equal(totalAmount, 975);
  assert.equal(schedule.totalAmount, 800);
  assert.deepEqual(schedule.installments.map((item) => item.amount), [266.67, 266.67, 266.66]);
  assert.equal(schedule.installments.reduce((sum, item) => sum + item.amount, 0), 800);
});

test("generates quarterly due dates", () => {
  const schedule = calculateInstallmentSchedule({
    totalAmount: 900,
    bookingAmount: 0,
    numberOfInstallments: 3,
    frequency: "quarterly",
    firstDueDate: "2026-01-15T00:00:00.000Z",
  });

  assert.deepEqual(schedule.installments.map((item) => item.dueDate), [
    "2026-01-15T00:00:00.000Z",
    "2026-04-15T00:00:00.000Z",
    "2026-07-15T00:00:00.000Z",
  ]);
});