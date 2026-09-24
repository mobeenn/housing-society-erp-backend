require("express-async-errors"); // patches express to forward async errors

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const ApiResponse = require("./utils/apiResponse");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const configuredOrigins = new Set(
  String(env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const productionFrontendOrigin = "https://housing-society-erp-frontend.vercel.app";
if (env.isProd) configuredOrigins.add(productionFrontendOrigin);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (configuredOrigins.has(origin)) return true;
  return env.isVercel
    && /^https:\/\/housing-society-erp-frontend(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin);
};

// ── Security headers ────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  })
);

// ── Body parsers ────────────────────────────────
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// ── Cookies ─────────────────────────────────────
app.use(cookieParser());

// ── HTTP request logging ────────────────────────
app.use(morgan(env.isDev ? "dev" : "combined"));

// ── Rate limiter on /api routes ─────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // A dashboard session can legitimately make many parallel API calls
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

// ══════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════

// Health check
app.get("/api/health", (_req, res) => {
  ApiResponse.success(res, 200, "OK", {
    storage: env.isVercel ? "ephemeral-demo" : "local-json-file",
    persistence: env.isVercel ? "resets-on-cold-start-or-redeploy" : "persistent-local-file",
  });
});

// ── Module routes ───────────────────────────────
const authRoutes = require("./modules/auth/routes");
const userRoutes = require("./modules/users/routes");
const roleRoutes = require("./modules/roles/routes");
const permissionRoutes = require("./modules/permissions/routes");
const administrationRoutes = require("./modules/administration/routes");
const memberRoutes = require("./modules/members/routes");
const plotRoutes = require("./modules/properties/routes");
const bookingRoutes = require("./modules/bookings/routes");
const documentRoutes = require("./modules/documents/routes");
const { paymentRouter, refundRouter } = require("./modules/payments/routes");
const expenseRoutes = require("./modules/expenses/routes");
const reportRoutes = require("./modules/reports/routes");
const dashboardRoutes = require("./modules/dashboards/routes");
const searchRoutes = require("./modules/search/routes");
const rbacRoutes = require("./modules/rbac/routes");
const inventoryRoutes = require("./modules/inventory/routes");
const invoiceRoutes = require("./modules/invoices/routes");
const recoveryRoutes = require("./modules/recovery/routes");
const notificationRoutes = require("./modules/notifications/routes");
const noticeRoutes = require("./modules/notices/routes");
const transferRoutes = require("./modules/transfers/routes");
const nocRoutes = require("./modules/nocs/routes");
const possessionRoutes = require("./modules/possession/routes");
const constructionRoutes = require("./modules/construction/routes");
const complaintRoutes = require("./modules/complaints/routes");
const { assetRouter, workOrderRouter } = require("./modules/maintenance/routes");
const securityRoutes = require("./modules/security-staff/routes");
const vehicleRoutes = require("./modules/vehicles/routes");
const visitorRoutes = require("./modules/visitors/routes");
const hrRoutes = require("./modules/hr/routes");
const hrPayrollRoutes = require("./modules/hr-payroll/routes");
const plotMergeRoutes = require("./modules/plot-merge/routes");
const buybackRoutes = require("./modules/buyback/routes");
const registryRoutes = require("./modules/registry/routes");
const appointmentRoutes = require("./modules/appointments/routes");
const procurementRoutes = require("./modules/procurement/routes");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/administration", administrationRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/plots", plotRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/payments", paymentRouter);
app.use("/api/refunds", refundRouter);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboards", dashboardRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/recovery", recoveryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/nocs", nocRoutes);
app.use("/api/possession", possessionRoutes);
app.use("/api/construction", constructionRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/assets", assetRouter);
app.use("/api/work-orders", workOrderRouter);
app.use("/api/security", securityRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/hr-payroll", hrPayrollRoutes);
app.use("/api/hr/payroll", hrPayrollRoutes);
app.use("/api/plot-merge", plotMergeRoutes);
app.use("/api/buyback", buybackRoutes);
app.use("/api/registry", registryRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/procurement", procurementRoutes);

// ── Catch-all & error handler ───────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
