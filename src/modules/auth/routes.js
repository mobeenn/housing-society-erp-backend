const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const AuthController = require("./controller");
const validate = require("../../middlewares/validate");
const { authenticate } = require("../../middlewares/auth");
const env = require("../../config/env");
const {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("./validation");

const authLimiterMessage = (message) => ({
  success: false,
  message,
  errors: [],
});

// Brute-force protection — skipped in development so local demos are not locked out.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDev ? 1000 : 5,
  skip: () => env.isDev,
  message: authLimiterMessage("Too many login attempts. Please try again after 15 minutes."),
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDev ? 1000 : 5,
  skip: () => env.isDev,
  message: authLimiterMessage(
    "Too many password reset requests. Please try again after 15 minutes."
  ),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginRateLimiter, validate(loginSchema), AuthController.login);
router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validate(forgotPasswordSchema),
  AuthController.forgotPassword
);
router.post("/reset-password", validate(resetPasswordSchema), AuthController.resetPassword);
router.post("/refresh", validate(refreshTokenSchema), AuthController.refresh);
router.post("/logout", AuthController.logout);
router.get("/me", authenticate, AuthController.me);
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  AuthController.changePassword
);

module.exports = router;
