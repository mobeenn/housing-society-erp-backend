const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../config/prisma");
const ApiError = require("../../utils/ApiError");
const env = require("../../config/env");

class AuthService {
  /**
   * Generate access and refresh tokens for a user.
   */
  static generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles?.map((r) => (typeof r === "object" ? r.name : r)),
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY,
    });

    const refreshToken = jwt.sign(
      { id: user.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Log in user with email & password.
   */
  static async login(email, password, ipAddress = null, userAgent = null) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      // Log failed login attempt
      await this._safeCreateAuditLog({
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
      await this._safeCreateAuditLog({
        userId: user.id,
        action: "login",
        ip: ipAddress,
        userAgent: userAgent,
        status: "failed",
        meta: { email: user.email, reason: "account_disabled" },
      });
      throw new ApiError(403, "Account is disabled. Please contact the administrator.");
    }

    // Accounts created without a password (staff/reference records) can never
    // authenticate, but must not throw inside bcrypt.
    const isMatch = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!isMatch) {
      // Log wrong password attempt
      await this._safeCreateAuditLog({
        userId: user.id,
        action: "login",
        ip: ipAddress,
        userAgent: userAgent,
        status: "failed",
        meta: { email: user.email, reason: "invalid_password" },
      });
      throw new ApiError(401, "Invalid email or password");
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = this.generateTokens(user);

    // Log successful login
    await this._safeCreateAuditLog({
      userId: user.id,
      action: "login",
      ip: ipAddress,
      userAgent: userAgent,
      status: "success",
      meta: { email: user.email },
    });

    // Return sanitized user object.
    // The legacy API returned a populated `roles` array, so keep that exact
    // response shape: expose `roles`, and do not leak the raw `userRoles`
    // join rows or the password hash.
    const { passwordHash, userRoles, ...safe } = user;
    const userObj = { ...safe, roles: userRoles.map((entry) => entry.role) };

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
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { userRoles: { include: { role: true } } },
      });

      if (!user || !user.isActive) {
        throw new ApiError(401, "Invalid or expired token");
      }

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
    await this._safeCreateAuditLog({
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      // Log failed password change
      await this._safeCreateAuditLog({
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
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash, mustResetPassword: false },
    });

    // Log successful password change
    await this._safeCreateAuditLog({
      userId,
      action: "change_password",
      ip: ipAddress,
      userAgent: userAgent,
      status: "success",
      meta: {},
    });

    return { message: "Password updated successfully" };
  }

  /**
   * Safely create an audit log entry — never throws.
   * Used for auth events that are not financial/ownership changes.
   */
  static async _safeCreateAuditLog({ userId, action, ip, userAgent, status, meta }) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          entityType: "auth",
          entityId: userId || null,
          action,
          ip: ip || null,
          userAgent: userAgent || null,
          status,
          meta: meta || {},
        },
      });
    } catch (err) {
      // Never break the main request
      console.error("[AuditLog] Failed to write audit log:", err.message);
    }
  }
}

module.exports = AuthService;
