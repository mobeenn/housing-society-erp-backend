const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nodeEnv = process.env.NODE_ENV || "development";
const isVercel = Boolean(process.env.VERCEL);
const isProd = nodeEnv === "production" || isVercel;
const defaultCorsOrigin = isProd
  ? "https://housing-society-erp-frontend.vercel.app"
  : "http://localhost:3000";

/**
 * Environment configuration. The fallback JWT values are only for the selected
 * ephemeral Vercel demo mode; set strong secrets for any persistent deployment.
 */
const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: nodeEnv,
  // PostgreSQL connection (to be added later)
  DATABASE_URL: process.env.DATABASE_URL || null,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "vercel-ephemeral-demo-access-secret-change-me",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "vercel-ephemeral-demo-refresh-secret-change-me",
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || defaultCorsOrigin,
  COOKIE_SECURE: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd,
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || (isProd ? "none" : "strict"),
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL || "admin@housing-society.local",
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || "SuperAdmin@123",
  isDev: !isProd,
  isProd,
  isVercel,
};

module.exports = env;
