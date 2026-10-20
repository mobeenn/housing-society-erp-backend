/**
 * P4-1: Approvals inbox aggregates pending items and applies SoD.
 */
const { test, mock, describe } = require("node:test");
const assert = require("node:assert/strict");
const ApprovalsService = require("../src/modules/approvals/service");
const RbacService = require("../src/modules/rbac/service");
const SocietySettings = require("../src/modules/administration/societySettings.model");
const { Booking } = require("../src/modules/bookings/booking.model");
const { Refund } = require("../src/modules/payments/payment.model");
const Expense = require("../src/modules/expenses/expense.model");
const TransferRequest = require("../src/modules/transfers/transfer.model");
const NocApplication = require("../src/modules/nocs/noc.model");
const PossessionApplication = require("../src/modules/possession/possession.model");
const { ConstructionApplication } = require("../src/modules/construction/construction.model");
const PayrollRun = require("../src/modules/hr-payroll/payrollRun.model");
const LeaveRequest = require("../src/modules/hr/leaveRequest.model");

describe("approvals pending", () => {
  test("includes bookings user can approve and excludes self-created when SoD on", async () => {
    mock.method(SocietySettings, "get", async () => ({ enforceSeparationOfDuties: true }));
    mock.method(RbacService, "isSuperAdmin", () => false);
    mock.method(RbacService, "isAllowed", async (_user, moduleKey, action) => {
      if (moduleKey === "bookings" && action === "approve") return true;
      return false;
    });
    mock.method(Booking, "find", async () => [
      { _id: "b1", bookingNumber: "BK-1", status: "Pending Approval", createdBy: "other", createdAt: "2026-01-02T00:00:00.000Z" },
      { _id: "b2", bookingNumber: "BK-2", status: "Pending Approval", createdBy: "me", createdAt: "2026-01-03T00:00:00.000Z" },
    ]);
    mock.method(Refund, "find", async () => []);
    mock.method(Expense, "find", async () => []);
    mock.method(TransferRequest, "find", async () => []);
    mock.method(NocApplication, "find", async () => []);
    mock.method(PossessionApplication, "find", async () => []);
    mock.method(ConstructionApplication, "find", async () => []);
    mock.method(PayrollRun, "find", async () => []);
    mock.method(LeaveRequest, "find", async () => []);

    const result = await ApprovalsService.pending({ _id: "me" });
    assert.equal(result.summary.total, 1);
    assert.equal(result.items[0].id, "b1");
    assert.equal(result.items[0].moduleKey, "bookings");
    mock.restoreAll();
  });

  test("returns empty when user has no approve permissions", async () => {
    mock.method(SocietySettings, "get", async () => ({ enforceSeparationOfDuties: true }));
    mock.method(RbacService, "isSuperAdmin", () => false);
    mock.method(RbacService, "isAllowed", async () => false);

    const result = await ApprovalsService.pending({ _id: "x" });
    assert.equal(result.summary.total, 0);
    assert.deepEqual(result.items, []);
    mock.restoreAll();
  });
});
