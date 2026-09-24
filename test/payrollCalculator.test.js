const test = require("node:test");
const assert = require("node:assert/strict");
const {
  attendanceProration,
  calculateProgressiveTax,
  calculatePayrollEntry,
  allocateLoans,
} = require("../src/modules/hr-payroll/payrollCalculator");
const { taxSlabSchema } = require("../src/modules/hr-payroll/validation");
const PayrollService = require("../src/modules/hr-payroll/service");

const setup = {
  salaryComponents: [
    { name: "Basic Salary", type: "Earning", calculationType: "Fixed" },
    { name: "Housing Allowance", type: "Earning", calculationType: "Fixed" },
  ],
  statutoryConfig: { eobiPercent: 1, providentFundPercent: 2 },
  taxSlabs: [
    { fromAmount: 0, toAmount: 600000, rate: 5 },
    { fromAmount: 600000, toAmount: null, rate: 10 },
  ],
};

test("tax slab validation preserves an open-ended upper bound", () => {
  const parsed = taxSlabSchema.parse({ fromAmount: 600000, toAmount: null, rate: 10 });
  assert.equal(parsed.toAmount, null);
});

test("payroll calculator applies progressive annual tax slabs", () => {
  const result = calculateProgressiveTax(100000, setup.taxSlabs);
  assert.equal(result.annualTax, 90000);
  assert.equal(result.monthlyTax, 7500);
});

test("payroll calculator deducts statutory amounts, tax, and active loan installment", () => {
  const entry = calculatePayrollEntry({
    employee: {
      _id: "employee-1",
      employeeId: "EMP-1",
      name: "Test Employee",
      basicSalary: 100000,
      salaryStructure: [{ component: "Basic Salary", amount: 100000 }],
    },
    setup,
    attendance: [],
    loans: [{ _id: "loan-1", status: "Active", remainingBalance: 50000, installmentAmount: 10000 }],
    year: 2026,
    month: 9,
  });

  assert.equal(entry.earnings, 100000);
  assert.equal(entry.deductions, 3000);
  assert.equal(entry.loanDeduction, 10000);
  assert.equal(entry.tax, 7500);
  assert.equal(entry.netPay, 79500);
  assert.deepEqual(entry.loanAllocations, [{ loan: "loan-1", amount: 10000 }]);
});

test("payroll calculator prorates only when the attendance period is complete", () => {
  const complete = Array.from({ length: 30 }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, "0")}`,
    status: "Present",
  })).filter((record) => {
    const day = new Date(`${record.date}T00:00:00.000Z`).getUTCDay();
    return day !== 0 && day !== 6;
  }).map((record, index) => index === 0 ? { ...record, status: "Absent" } : record);
  const summary = attendanceProration(complete, 2026, 9);
  assert.equal(summary.prorationApplied, true);
  assert.equal(summary.presentDays, 21);
  assert.equal(summary.factor, 0.95);

  const incomplete = attendanceProration(complete.slice(0, 3), 2026, 9);
  assert.equal(incomplete.prorationApplied, false);
  assert.equal(incomplete.factor, 1);
});

test("loan allocation is capped by remaining balance and available earnings", () => {
  const result = allocateLoans([
    { _id: "loan-1", status: "Active", remainingBalance: 5000, installmentAmount: 10000 },
    { _id: "loan-2", status: "Closed", remainingBalance: 10000, installmentAmount: 1000 },
  ], 7000);
  assert.deepEqual(result, { allocations: [{ loan: "loan-1", amount: 5000 }], total: 5000 });
});

test("payroll GL lines balance gross payroll against liabilities and net pay", () => {
  const lines = PayrollService.buildGLLines({
    totals: { earnings: 100000, loanDeduction: 10000, tax: 7500, netPay: 79500 },
    entries: [
      { statutory: { eobi: 1000, providentFund: 2000 }, deductionsBreakdown: { salaryComponents: [] } },
    ],
  });
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  assert.equal(debit, 100000);
  assert.equal(credit, 100000);
});
