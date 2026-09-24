const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Environment configuration
 * PostgreSQL will be configured when connection string is available
 */
const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  // PostgreSQL connection (to be added later)
  DATABASE_URL: process.env.DATABASE_URL || null,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL || "admin@housing-society.local",
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || "SuperAdmin@123",
  isDev: (process.env.NODE_ENV || "development") === "development",
  isProd: process.env.NODE_ENV === "production",
};

module.exports = env;
