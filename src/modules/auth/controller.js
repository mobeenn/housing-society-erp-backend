const AuthService = require("./service");
const ApiResponse = require("../../utils/apiResponse");

class AuthController {
  static async login(req, res) {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    const result = await AuthService.login(email, password, ipAddress, userAgent);

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return ApiResponse.success(res, 200, "Login successful", {
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  static async refresh(req, res) {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const tokens = await AuthService.refresh(token);

    // Set updated refresh token cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return ApiResponse.success(res, 200, "Token refreshed", {
      accessToken: tokens.accessToken,
    });
  }

  static async logout(req, res) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    // Log the logout if user is authenticated
    if (req.user && req.user.id) {
      await AuthService.logout(req.user.id, ipAddress, userAgent);
    }

    res.clearCookie("refreshToken");
    return ApiResponse.success(res, 200, "Logged out successfully");
  }

  static async me(req, res) {
    return ApiResponse.success(res, 200, "User profile", req.user);
  }

  static async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    const result = await AuthService.changePassword(
      req.user.id,
      currentPassword,
      newPassword,
      ipAddress,
      userAgent
    );
    return ApiResponse.success(res, 200, result.message);
  }
}

module.exports = AuthController;
