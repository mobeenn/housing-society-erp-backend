const ExpenseService = require("./service");
const ApiResponse = require("../../utils/apiResponse");
exports.getExpenses = async (req, res) => ApiResponse.success(res, 200, await ExpenseService.list(req.query));
exports.createExpense = async (req, res) => ApiResponse.success(res, 201, await ExpenseService.create(req.body, req), "Expense created successfully");
exports.approveExpense = async (req, res) => ApiResponse.success(res, 200, await ExpenseService.transition(req.params.id, "approve", req), "Expense approved");
exports.rejectExpense = async (req, res) => ApiResponse.success(res, 200, await ExpenseService.transition(req.params.id, "reject", req), "Expense rejected");
exports.payExpense = async (req, res) => ApiResponse.success(res, 200, await ExpenseService.transition(req.params.id, "pay", req), "Expense marked paid");