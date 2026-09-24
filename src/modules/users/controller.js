const UserService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

class UserController {
  static async getAll(req, res) {
    const result = await UserService.getAll(req.query);
    ApiResponse.success(res, 200, result);
  }

  static async getById(req, res) {
    const user = await UserService.getById(req.params.id);
    ApiResponse.success(res, 200, user);
  }

  static async create(req, res) {
    const user = await UserService.create(req.body, req.user.id, req);
    ApiResponse.success(res, 201, user, "User created successfully");
  }

  static async update(req, res) {
    const user = await UserService.update(req.params.id, req.body, req);
    ApiResponse.success(res, 200, user, "User updated successfully");
  }

  static async deactivate(req, res) {
    const user = await UserService.deactivate(req.params.id, req);
    ApiResponse.success(res, 200, user, "User deactivated successfully");
  }

  static async toggleActive(req, res) {
    const user = await UserService.toggleActive(req.params.id, req);
    ApiResponse.success(
      res,
      200,
      user,
      `User ${user.isActive ? "activated" : "deactivated"} successfully`
    );
  }

  static async triggerPasswordReset(req, res) {
    const result = await UserService.triggerPasswordReset(req.params.id, req);
    ApiResponse.success(res, 200, result, result.message);
  }
}

module.exports = UserController;
