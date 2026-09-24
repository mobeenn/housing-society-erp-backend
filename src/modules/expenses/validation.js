const { z } = require("zod");
const Expense = require("./expense.model");

const createExpenseSchema = z.object({ category: z.string().min(1), vendor: z.string().optional().nullable(), amount: z.coerce.number().positive(), date: z.string().optional(), supportingDocuments: z.array(z.string()).optional().default([]) });
const EXPENSE_STATUSES = Object.values(Expense.STATUS);
module.exports = { createExpenseSchema, EXPENSE_STATUSES };