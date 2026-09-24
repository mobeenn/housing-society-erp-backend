const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const AuthController = require("./controller");
const validate = require("../../middlewares/validate");
const { authenticate } = require("../../middlewares/auth");
const {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} = require("./validation");

// Rate limiter for login endpoint (brute-force protection)
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginRateLimiter, validate(loginSchema), AuthController.login);
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
