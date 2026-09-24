const ExcelJS = require("exceljs");
const Employee = require("../hr/employee.model");
const Attendance = require("../hr/attendance.model");
const User = require("../auth/user.model");
const ApiError = require("../../utils/ApiError");
const { createAuditLog } = require("../administration/auditLog.model");
const HRSetup = require("./hrSetup.model");
const Loan = require("./loan.model");
const PayrollRun = require("./payrollRun.model");
const {
  roundMoney,
  calculatePayrollEntry,
} = require("./payrollCalculator");
const { postToGL } = require("../finance-gl/postToGL");

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const actorId = (req) => req?.user?._id || req?.userId || null;
const employeeName = (employee) => employee?.name || employee?.employeeId || "Unknown employee";
const safeUser = (user) => user ? { _id: user._id, name: user.name, email: user.email } : null;
const safeEmployee = (employee) => employee ? {
  _id: employee._id,
  employeeId: employee.employeeId,
  name: employee.name,
  department: employee.department,
  designation: employee.designation,
  status: employee.status,
  salaryStructure: employee.salaryStructure || [],
} : null;

function paginate(rows, page = 1, limit = 50) {
  const currentPage = Math.max(1, number(page) || 1);
  const pageSize = Math.min(200, Math.max(1, number(limit) || 50));
  const start = (currentPage - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    pagination: {
      page: currentPage,
      limit: pageSize,
      total: rows.length,
      pages: Math.ceil(rows.length / pageSize),
    },
  };
}

function sumRunTotals(entries = []) {
  return entries.reduce((totals, entry) => ({
    earnings: roundMoney(totals.earnings + number(entry.earnings)),
    deductions: roundMoney(totals.deductions + number(entry.deductions)),
    loanDeduction: roundMoney(totals.loanDeduction + number(entry.loanDeduction)),
    tax: roundMoney(totals.tax + number(entry.tax)),
    netPay: roundMoney(totals.netPay + number(entry.netPay)),
  }), { earnings: 0, deductions: 0, loanDeduction: 0, tax: 0, netPay: 0 });
}

async function enrichRun(run) {
  if (!run) return null;
  const employees = await Employee.find({});
  const employeeMap = new Map(employees.map((employee) => [employee._id, employee]));
  const [generatedBy, approvedBy, paidBy] = await Promise.all([
    run.generatedBy ? User.findById(run.generatedBy) : null,
    run.approvedBy ? User.findById(run.approvedBy) : null,
    run.paidBy ? User.findById(run.paidBy) : null,
  ]);
  return {
    ...run,
    generatedByRef: safeUser(generatedBy),
    approvedByRef: safeUser(approvedBy),
    paidByRef: safeUser(paidBy),
    entries: (run.entries || []).map((entry) => ({
      ...entry,
      employeeRef: safeEmployee(employeeMap.get(entry.employee)),
    })),
    totals: run.totals || sumRunTotals(run.entries || []),
  };
}

function csvBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Payroll");
  rows.forEach((row) => worksheet.addRow(row));
  return workbook.csv.writeBuffer().then((buffer) => Buffer.from(buffer));
}

class PayrollService {
  static async getSetup() {
    return HRSetup.get();
  }

  static async updateSetup(data, req) {
    const current = await this.getSetup();
    const statutoryConfig = {
      ...(current.statutoryConfig || {}),
      ...(data.statutoryConfig || {}),
    };
    if (data.statutoryConfig?.eobi !== undefined && data.statutoryConfig?.eobiPercent === undefined && data.statutoryConfig?.eobiPercentage === undefined) {
      statutoryConfig.eobiPercent = data.statutoryConfig.eobi;
    }
    if (data.statutoryConfig?.providentFund !== undefined && data.statutoryConfig?.providentFundPercent === undefined && data.statutoryConfig?.providentFundPercentage === undefined) {
      statutoryConfig.providentFundPercent = data.statutoryConfig.providentFund;
    }
    const next = {
      ...current,
      ...data,
      statutoryConfig,
    };
    const setup = await HRSetup.update(next, actorId(req));
    await createAuditLog({
      req,
      entityType: "HRSetup",
      entityId: setup._id,
      action: "UPDATE",
      changes: { before: current, after: setup },
    });
    return setup;
  }

  static async findActiveEmployees() {
    return Employee.find({ status: Employee.STATUSES.ACTIVE }, { sort: { name: 1 } });
  }

  static async listEmployees() {
    const employees = await this.findActiveEmployees();
    return employees.map(safeEmployee);
  }

  static async assignSalaryStructure(employeeId, salaryStructure, req) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new ApiError(404, "Employee not found");
    const before = employee.salaryStructure || [];
    await Employee.update(employeeId, { salaryStructure });
    await createAuditLog({
      req,
      entityType: "Employee",
      entityId: employeeId,
      action: "UPDATE",
      changes: { field: "salaryStructure", before, after: salaryStructure },
    });
    return safeEmployee(await Employee.findById(employeeId));
  }

  static async listLoans({ employee, status, page = 1, limit = 50 } = {}) {
    const query = {};
    if (employee) query.employee = employee;
    if (status) query.status = status;
    const loans = await Loan.find(query, { sort: { disbursedDate: -1 } });
    const employees = await Employee.find({});
    const employeeMap = new Map(employees.map((item) => [item._id, item]));
    const rows = loans.map((loan) => ({ ...loan, employeeRef: safeEmployee(employeeMap.get(loan.employee)) }));
    return paginate(rows, page, limit);
  }

  static async createLoan(data, req) {
    const employee = await Employee.findById(data.employee);
    if (!employee) throw new ApiError(404, "Employee not found");
    if (number(data.installmentAmount) > number(data.amount)) {
      throw new ApiError(400, "Installment amount cannot exceed the loan amount");
    }
    const loan = await Loan.create(data, actorId(req));
    await createAuditLog({
      req,
      entityType: "Loan",
      entityId: loan._id,
      action: "CREATE",
      changes: { after: loan },
    });
    return loan;
  }

  static async closeLoan(id, req) {
    const loan = await Loan.findById(id);
    if (!loan) throw new ApiError(404, "Loan not found");
    if (loan.status === Loan.STATUS.CLOSED) return loan;
    await Loan.close(id, actorId(req));
    await createAuditLog({
      req,
      entityType: "Loan",
      entityId: id,
      action: "UPDATE",
      changes: { status: { before: loan.status, after: Loan.STATUS.CLOSED } },
    });
    return Loan.findById(id);
  }

  static async generateDraft({ year, month }, req) {
    const periodYear = number(year);
    const periodMonth = number(month);
    const existing = await PayrollRun.findByPeriod(periodYear, periodMonth);
    if (existing) {
      throw new ApiError(409, `A payroll run already exists for ${periodMonth}/${periodYear}`);
    }

    const [setup, employees, attendance] = await Promise.all([
      this.getSetup(),
      this.findActiveEmployees(),
      Attendance.find({}),
    ]);
    if (!employees.length) throw new ApiError(400, "No active employees are available for payroll");

    const entries = [];
    for (const employee of employees) {
      const employeeAttendance = attendance.filter((record) => record.employee === employee._id);
      const loans = await Loan.findActiveByEmployee(employee._id);
      entries.push(calculatePayrollEntry({
        employee,
        setup,
        attendance: employeeAttendance,
        loans,
        year: periodYear,
        month: periodMonth,
      }));
    }

    const run = await PayrollRun.create({
      month: periodMonth,
      year: periodYear,
      status: PayrollRun.STATUS.DRAFT,
      generatedBy: actorId(req),
      entries,
      totals: sumRunTotals(entries),
    });
    await createAuditLog({
      req,
      entityType: "PayrollRun",
      entityId: run._id,
      action: "CREATE",
      changes: { month: periodMonth, year: periodYear, status: PayrollRun.STATUS.DRAFT },
    });
    return this.getPayrollRun(run._id);
  }

  static async listPayrollRuns({ year, month, status, page = 1, limit = 50 } = {}) {
    const query = {};
    if (year) query.year = number(year);
    if (month) query.month = number(month);
    if (status) query.status = status;
    const runs = await PayrollRun.find(query, { sort: { year: -1, month: -1 } });
    return paginate(runs, page, limit);
  }

  static async getPayrollRun(id) {
    const run = await PayrollRun.findById(id);
    if (!run) throw new ApiError(404, "Payroll run not found");
    return enrichRun(run);
  }

  static buildGLLines(run) {
    const totals = run.totals || sumRunTotals(run.entries || []);
    const eobi = roundMoney((run.entries || []).reduce((sum, entry) => sum + number(entry.statutory?.eobi), 0));
    const providentFund = roundMoney((run.entries || []).reduce((sum, entry) => sum + number(entry.statutory?.providentFund), 0));
    const otherDeductions = roundMoney((run.entries || []).reduce((sum, entry) => sum + (entry.deductionsBreakdown?.salaryComponents || []).reduce((componentSum, component) => componentSum + number(component.amount), 0), 0));
    const lines = [
      { accountCode: "6100", account: "Salary Expense", debit: number(totals.earnings), credit: 0 },
      { accountCode: "2100", account: "EOBI Payable", debit: 0, credit: eobi },
      { accountCode: "2110", account: "Provident Fund Payable", debit: 0, credit: providentFund },
      { accountCode: "2120", account: "Payroll Tax Payable", debit: 0, credit: number(totals.tax) },
      { accountCode: "2200", account: "Employee Loan Payable", debit: 0, credit: number(totals.loanDeduction) },
      { accountCode: "2140", account: "Other Payroll Deductions Payable", debit: 0, credit: otherDeductions },
      { accountCode: "2130", account: "Net Salary Payable", debit: 0, credit: number(totals.netPay) },
    ];
    return lines.filter((line) => line.debit > 0 || line.credit > 0);
  }

  static async approvePayroll(id, req) {
    const run = await PayrollRun.findById(id);
    if (!run) throw new ApiError(404, "Payroll run not found");
    if (run.status !== PayrollRun.STATUS.DRAFT) {
      throw new ApiError(409, `Only Draft payroll runs can be approved (current status: ${run.status})`);
    }

    const posting = await postToGL({
      date: new Date(Date.UTC(number(run.year), number(run.month), 0)).toISOString().slice(0, 10),
      sourceType: "PayrollRun",
      sourceId: run._id,
      description: `Payroll ${run.month}/${run.year}`,
      lines: this.buildGLLines(run),
      postedBy: actorId(req),
    });
    await PayrollRun.update(run._id, {
      status: PayrollRun.STATUS.APPROVED,
      approvedBy: actorId(req),
      approvedAt: new Date().toISOString(),
      journalEntryId: posting.journalEntry._id,
      glPosting: {
        journalEntryId: posting.journalEntry._id,
        totalDebit: posting.journalEntry.totalDebit,
        totalCredit: posting.journalEntry.totalCredit,
        created: posting.created,
      },
    });
    await createAuditLog({
      req,
      entityType: "PayrollRun",
      entityId: run._id,
      action: "APPROVE",
      changes: { status: { before: PayrollRun.STATUS.DRAFT, after: PayrollRun.STATUS.APPROVED }, journalEntryId: posting.journalEntry._id },
    });
    return this.getPayrollRun(run._id);
  }

  static async markPaid(id, req) {
    const run = await PayrollRun.findById(id);
    if (!run) throw new ApiError(404, "Payroll run not found");
    if (run.status !== PayrollRun.STATUS.APPROVED) {
      throw new ApiError(409, `Only Approved payroll runs can be marked paid (current status: ${run.status})`);
    }

    for (const entry of run.entries || []) {
      for (const allocation of entry.loanAllocations || []) {
        const loan = await Loan.findById(allocation.loan);
        if (!loan || loan.status !== Loan.STATUS.ACTIVE) continue;
        const applied = roundMoney(Math.min(number(allocation.amount), number(loan.remainingBalance)));
        if (applied <= 0) continue;
        const remaining = roundMoney(Math.max(0, number(loan.remainingBalance) - applied));
        await Loan.update(loan._id, {
          remainingBalance: remaining,
          status: remaining <= 0.009 ? Loan.STATUS.CLOSED : Loan.STATUS.ACTIVE,
          lastDeductionRun: run._id,
          lastDeductionAt: new Date().toISOString(),
        });
      }
    }

    await PayrollRun.update(run._id, {
      status: PayrollRun.STATUS.PAID,
      paidBy: actorId(req),
      paidAt: new Date().toISOString(),
    });
    await createAuditLog({
      req,
      entityType: "PayrollRun",
      entityId: run._id,
      action: "UPDATE",
      changes: { status: { before: PayrollRun.STATUS.APPROVED, after: PayrollRun.STATUS.PAID } },
    });
    return this.getPayrollRun(run._id);
  }

  static async exportRegisterCsv(id) {
    const run = await this.getPayrollRun(id);
    const rows = [
      ["Employee ID", "Employee", "Month", "Year", "Earnings", "Deductions", "Loan Deduction", "Tax", "Net Pay", "Status"],
      ...(run.entries || []).map((entry) => [
        entry.employeeId,
        entry.employeeRef ? employeeName(entry.employeeRef) : entry.employeeName,
        run.month,
        run.year,
        entry.earnings,
        entry.deductions,
        entry.loanDeduction,
        entry.tax,
        entry.netPay,
        run.status,
      ]),
    ];
    return csvBuffer(rows);
  }

  static async exportPayslipsCsv(id) {
    const run = await this.getPayrollRun(id);
    const rows = [
      ["Employee ID", "Employee", "Period", "Earnings", "Salary Deductions", "Statutory Deductions", "Loan Deduction", "Tax", "Net Pay"],
      ...(run.entries || []).map((entry) => [
        entry.employeeId,
        entry.employeeRef ? employeeName(entry.employeeRef) : entry.employeeName,
        `${String(run.year).padStart(4, "0")}-${String(run.month).padStart(2, "0")}`,
        entry.earnings,
        entry.deductionsBreakdown?.salaryComponents?.reduce((sum, item) => sum + number(item.amount), 0) || 0,
        number(entry.deductionsBreakdown?.eobi) + number(entry.deductionsBreakdown?.providentFund),
        entry.loanDeduction,
        entry.tax,
        entry.netPay,
      ]),
    ];
    return csvBuffer(rows);
  }
}

module.exports = PayrollService;
module.exports.sumRunTotals = sumRunTotals;
