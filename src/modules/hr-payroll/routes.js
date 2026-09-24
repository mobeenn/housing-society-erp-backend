const express = require("express");
const { authenticate, authorize } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const {
  updateSetupSchema,
  salaryStructureSchema,
  createLoanSchema,
  payrollPeriodSchema,
  listPayrollSchema,
} = require("./validation");
const controller = require("./controller");

const router = express.Router();
router.use(authenticate);

router.get("/setup", authorize("hr-payroll", "view"), controller.getSetup);
router.put("/setup", authorize("hr-payroll", "edit"), validate(updateSetupSchema), controller.updateSetup);
router.get("/settings", authorize("hr-payroll", "view"), controller.getSetup);
router.put("/settings", authorize("hr-payroll", "edit"), validate(updateSetupSchema), controller.updateSetup);

router.get("/employees", authorize("hr-payroll", "view"), controller.listEmployees);
router.put("/employees/:id/salary-structure", authorize("hr-payroll", "edit"), validate(salaryStructureSchema), controller.assignSalaryStructure);

router.get("/loans", authorize("hr-payroll", "view"), controller.listLoans);
router.get("/employees/:id/loans", authorize("hr-payroll", "view"), controller.listLoans);
router.post("/loans", authorize("hr-payroll", "create"), validate(createLoanSchema), controller.createLoan);
router.post("/loans/:id/close", authorize("hr-payroll", "edit"), controller.closeLoan);
router.put("/loans/:id/close", authorize("hr-payroll", "edit"), controller.closeLoan);

router.get("/payroll-runs", authorize("hr-payroll", "view"), validate(listPayrollSchema, "query"), controller.listRuns);
router.post("/payroll-runs", authorize("hr-payroll", "create"), validate(payrollPeriodSchema), controller.generateDraft);
router.post("/payroll-runs/generate", authorize("hr-payroll", "create"), validate(payrollPeriodSchema), controller.generateDraft);
router.get("/payroll-runs/:id/register.csv", authorize("hr-payroll", "export"), controller.exportRegister);
router.get("/payroll-runs/:id/payslips.csv", authorize("hr-payroll", "export"), controller.exportPayslips);
router.post("/payroll-runs/:id/approve", authorize("hr-payroll", "approve"), controller.approve);
router.post("/payroll-runs/:id/pay", authorize("hr-payroll", "edit"), controller.markPaid);
router.post("/payroll-runs/:id/mark-paid", authorize("hr-payroll", "edit"), controller.markPaid);
router.get("/payroll-runs/:id", authorize("hr-payroll", "view"), controller.getRun);

module.exports = router;
