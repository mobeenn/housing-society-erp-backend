const PayrollService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

exports.getSetup = async (_req, res) => ApiResponse.success(res, 200, "HR payroll setup retrieved", await PayrollService.getSetup());
exports.updateSetup = async (req, res) => ApiResponse.success(res, 200, "HR payroll setup updated", await PayrollService.updateSetup(req.body, req));
exports.listEmployees = async (_req, res) => ApiResponse.success(res, 200, "Payroll employees retrieved", await PayrollService.listEmployees());
exports.assignSalaryStructure = async (req, res) => ApiResponse.success(res, 200, "Salary structure assigned", await PayrollService.assignSalaryStructure(req.params.id, req.body.salaryStructure, req));
exports.listLoans = async (req, res) => ApiResponse.success(res, 200, "Loans retrieved", await PayrollService.listLoans({ ...req.query, employee: req.params.id || req.query.employee }));
exports.createLoan = async (req, res) => ApiResponse.success(res, 201, "Loan disbursed successfully", await PayrollService.createLoan(req.body, req));
exports.closeLoan = async (req, res) => ApiResponse.success(res, 200, "Loan closed successfully", await PayrollService.closeLoan(req.params.id, req));
exports.generateDraft = async (req, res) => ApiResponse.success(res, 201, "Payroll draft generated", await PayrollService.generateDraft(req.body, req));
exports.listRuns = async (req, res) => ApiResponse.success(res, 200, "Payroll runs retrieved", await PayrollService.listPayrollRuns(req.query));
exports.getRun = async (req, res) => ApiResponse.success(res, 200, "Payroll run retrieved", await PayrollService.getPayrollRun(req.params.id));
exports.approve = async (req, res) => ApiResponse.success(res, 200, "Payroll run approved and posted to GL", await PayrollService.approvePayroll(req.params.id, req));
exports.markPaid = async (req, res) => ApiResponse.success(res, 200, "Payroll run marked paid", await PayrollService.markPaid(req.params.id, req));

exports.exportRegister = async (req, res) => {
  const buffer = await PayrollService.exportRegisterCsv(req.params.id);
  res.type("text/csv")
    .setHeader("Content-Disposition", `attachment; filename=payroll-register-${req.params.id}.csv`)
    .send(buffer);
};

exports.exportPayslips = async (req, res) => {
  const buffer = await PayrollService.exportPayslipsCsv(req.params.id);
  res.type("text/csv")
    .setHeader("Content-Disposition", `attachment; filename=payroll-payslips-${req.params.id}.csv`)
    .send(buffer);
};
