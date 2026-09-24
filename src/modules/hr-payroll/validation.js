const { z } = require("zod");
const Loan = require("./loan.model");
const PayrollRun = require("./payrollRun.model");

const finiteAmount = z.coerce.number().finite();
const nonNegativeAmount = finiteAmount.nonnegative();
const positiveAmount = finiteAmount.positive();

const salaryComponentSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["Earning", "Deduction"]),
  calculationType: z.enum(["Fixed", "Percentage"]),
});

const statutoryConfigSchema = z.object({
  eobiPercent: nonNegativeAmount.max(100).optional(),
  eobiPercentage: nonNegativeAmount.max(100).optional(),
  eobi: nonNegativeAmount.max(100).optional(),
  providentFundPercent: nonNegativeAmount.max(100).optional(),
  providentFundPercentage: nonNegativeAmount.max(100).optional(),
  providentFund: nonNegativeAmount.max(100).optional(),
});

const taxSlabSchema = z.object({
  fromAmount: nonNegativeAmount,
  toAmount: z.union([z.null(), nonNegativeAmount]),
  rate: nonNegativeAmount.max(100),
});

const updateSetupSchema = z.object({
  salaryComponents: z.array(salaryComponentSchema).max(100).optional(),
  statutoryConfig: statutoryConfigSchema.optional(),
  taxSlabs: z.array(taxSlabSchema).max(100).optional(),
});

const salaryStructureSchema = z.object({
  salaryStructure: z.array(z.object({
    component: z.string().trim().min(1),
    amount: nonNegativeAmount,
  })).max(100),
});

const createLoanSchema = z.object({
  employee: z.string().min(1),
  amount: positiveAmount,
  installmentAmount: positiveAmount,
  disbursedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const payrollPeriodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2200),
});

const payrollRunStatusSchema = z.object({
  status: z.enum(Object.values(PayrollRun.STATUS)),
});

const listPayrollSchema = payrollPeriodSchema.partial().extend({
  status: z.enum(Object.values(PayrollRun.STATUS)).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

module.exports = {
  salaryComponentSchema,
  statutoryConfigSchema,
  taxSlabSchema,
  updateSetupSchema,
  salaryStructureSchema,
  createLoanSchema,
  payrollPeriodSchema,
  payrollRunStatusSchema,
  listPayrollSchema,
  loanStatuses: Object.values(Loan.STATUS),
};
