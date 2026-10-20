/**
 * P2-4: Same user cannot create and approve when SoD is on.
 */
const { test, mock, describe } = require("node:test");
const assert = require("node:assert/strict");
const SocietySettings = require("../src/modules/administration/societySettings.model");
const { assertSeparationOfDuties } = require("../src/utils/separationOfDuties");
const RbacService = require("../src/modules/rbac/service");
const ExpenseService = require("../src/modules/expenses/service");
const Expense = require("../src/modules/expenses/expense.model");
const { PaymentService } = require("../src/modules/payments/service");
const { Refund } = require("../src/modules/payments/payment.model");
const BookingService = require("../src/modules/bookings/service");
const { Booking } = require("../src/modules/bookings/booking.model");
const PayrollService = require("../src/modules/hr-payroll/service");
const PayrollRun = require("../src/modules/hr-payroll/payrollRun.model");

function mockSettings(enabled) {
  mock.method(SocietySettings, "get", async () => ({
    enforceSeparationOfDuties: enabled,
  }));
}

describe("separation of duties helper", () => {
  test("blocks creator approving own document", async () => {
    mockSettings(true);
    mock.method(RbacService, "isSuperAdmin", () => false);
    const req = { user: { id: "user-a", _id: "user-a" } };
    await assert.rejects(
      () => assertSeparationOfDuties(req, "user-a", "an expense"),
      (err) => Number(err.statusCode) === 403
    );
    mock.restoreAll();
  });

  test("allows different user to approve (approve-as-B)", async () => {
    mockSettings(true);
    mock.method(RbacService, "isSuperAdmin", () => false);
    const req = { user: { id: "user-b", _id: "user-b" } };
    await assertSeparationOfDuties(req, "user-a", "an expense");
    await assertSeparationOfDuties(req, "user-a", "a refund");
    await assertSeparationOfDuties(req, "user-a", "a payroll run");
    await assertSeparationOfDuties(req, "user-a", "a booking");
    mock.restoreAll();
  });

  test("Super Admin is exempt", async () => {
    mockSettings(true);
    mock.method(RbacService, "isSuperAdmin", () => true);
    const req = { user: { id: "user-a", _id: "user-a" } };
    await assertSeparationOfDuties(req, "user-a", "a booking");
    mock.restoreAll();
  });

  test("disabled flag allows self-approve", async () => {
    mockSettings(false);
    mock.method(RbacService, "isSuperAdmin", () => false);
    const req = { user: { id: "user-a", _id: "user-a" } };
    await assertSeparationOfDuties(req, "user-a", "a refund");
    mock.restoreAll();
  });
});

describe("SoD on document approve paths (create-as-A / approve-as-A fails)", () => {
  test("expense", async () => {
    mockSettings(true);
    mock.method(RbacService, "isSuperAdmin", () => false);
    mock.method(Expense, "findById", async () => ({
      _id: "exp1",
      status: Expense.STATUS.PENDING,
      createdBy: "user-a",
    }));
    await assert.rejects(
      () => ExpenseService.transition("exp1", "approve", { user: { _id: "user-a", id: "user-a" } }),
      (err) => Number(err.statusCode) === 403
    );
    mock.restoreAll();
  });

  test("refund", async () => {
    mockSettings(true);
    mock.method(RbacService, "isSuperAdmin", () => false);
    mock.method(Refund, "findById", async () => ({
      _id: "ref1",
      status: Refund.STATUS.PENDING,
      createdBy: "user-a",
    }));
    await assert.rejects(
      () => PaymentService.updateRefund("ref1", "approve", { user: { _id: "user-a", id: "user-a" } }),
      (err) => Number(err.statusCode) === 403
    );
    mock.restoreAll();
  });

  test("booking", async () => {
    mockSettings(true);
    mock.method(RbacService, "isSuperAdmin", () => false);
    mock.method(Booking, "findById", async () => ({
      _id: "bk1",
      status: Booking.STATUS.PENDING_APPROVAL,
      createdBy: "user-a",
      planTemplate: {},
    }));
    await assert.rejects(
      () => BookingService.approve("bk1", {}, { user: { _id: "user-a", id: "user-a" } }),
      (err) => Number(err.statusCode) === 403
    );
    mock.restoreAll();
  });

  test("payroll", async () => {
    mockSettings(true);
    mock.method(RbacService, "isSuperAdmin", () => false);
    mock.method(PayrollRun, "findById", async () => ({
      _id: "pr1",
      status: PayrollRun.STATUS.DRAFT,
      generatedBy: "user-a",
      month: 1,
      year: 2026,
      entries: [],
      totals: {},
    }));
    await assert.rejects(
      () => PayrollService.approvePayroll("pr1", { user: { _id: "user-a", id: "user-a" } }),
      (err) => Number(err.statusCode) === 403
    );
    mock.restoreAll();
  });
});
