const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./user.model");
const AuditLog = require("./auditLog.model");
const ApiError = require("../../utils/ApiError");
const env = require("../../config/env");

class AuthService {
  /**
   * Generate access and refresh tokens for a user.
   */
  static generateTokens(user) {
    const payload = {
      id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles?.map((r) => (typeof r === "object" ? r.name : r)),
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY,
    });

    const refreshToken = jwt.sign(
      { id: user._id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Log in user with email & password.
   */
  static async login(email, password, ipAddress = null, userAgent = null) {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Log failed login attempt
      await AuditLog.create({
        userId: null,
        action: "login",
        ip: ipAddress,
        userAgent: userAgent,
        status: "failed",
        meta: { email: email.toLowerCase(), reason: "user_not_found" },
      });
      throw new ApiError(401, "Invalid email or password");
    }

    if (!user.isActive) {
      // Log disabled account attempt
      await AuditLog.create({
        userId: user._id,
        action: "login",
        ip: ipAddress,
        userAgent: userAgent,
        status: "failed",
        meta: { email: user.email, reason: "account_disabled" },
      });
      throw new ApiError(403, "Account is disabled. Please contact the administrator.");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Log wrong password attempt
      await AuditLog.create({
        userId: user._id,
        action: "login",
        ip: ipAddress,
        userAgent: userAgent,
        status: "failed",
        meta: { email: user.email, reason: "invalid_password" },
      });
      throw new ApiError(401, "Invalid email or password");
    }

    // Populate roles
    await User.populate(user, "roles");

    // Update last login timestamp
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date().toISOString() } }
    );
    user.lastLoginAt = new Date().toISOString();

    const { accessToken, refreshToken } = this.generateTokens(user);

    // Log successful login
    await AuditLog.create({
      userId: user._id,
      action: "login",
      ip: ipAddress,
      userAgent: userAgent,
      status: "success",
      meta: { email: user.email },
    });

    // Return sanitized user object
    const userObj = { ...user };
    delete userObj.passwordHash;

    return { user: userObj, accessToken, refreshToken };
  }

  /**
   * Refresh the access token using a refresh token.
   */
  static async refresh(refreshToken) {
    if (!refreshToken) {
      throw new ApiError(401, "Refresh token required");
    }

    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        throw new ApiError(401, "Invalid or expired token");
      }

      // Populate roles
      await User.populate(user, "roles");

      const tokens = this.generateTokens(user);
      return tokens;
    } catch (error) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }
  }

  /**
   * Log out user (for audit trail).
   */
  static async logout(userId, ipAddress = null, userAgent = null) {
    await AuditLog.create({
      userId,
      action: "logout",
      ip: ipAddress,
      userAgent: userAgent,
      status: "success",
      meta: {},
    });
  }

  /**
   * Change user password.
   */
  static async changePassword(userId, currentPassword, newPassword, ipAddress = null, userAgent = null) {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      // Log failed password change
      await AuditLog.create({
        userId,
        action: "change_password",
        ip: ipAddress,
        userAgent: userAgent,
        status: "failed",
        meta: { reason: "incorrect_current_password" },
      });
      throw new ApiError(400, "Current password is incorrect");
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { _id: userId },
      { $set: { passwordHash: newPasswordHash, mustResetPassword: false } }
    );

    // Log successful password change
    await AuditLog.create({
      userId,
      action: "change_password",
      ip: ipAddress,
      userAgent: userAgent,
      status: "success",
      meta: {},
    });

    return { message: "Password updated successfully" };
  }
}

module.exports = AuthService;
