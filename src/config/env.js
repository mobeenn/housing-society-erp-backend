const dotenv = require("dotenv");
const path = require("path");
const { z } = require("zod");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nodeEnv = process.env.NODE_ENV || "development";
const isVercel = Boolean(process.env.VERCEL);
const isProd = nodeEnv === "production" || isVercel;
const defaultCorsOrigin = isProd
  ? "https://housing-society-erp-frontend.vercel.app"
  : "http://localhost:3000";

// ── Zod schema for environment validation ──────────────────────────────
// SUPABASE_SECRET_KEY bypasses RLS — server-side only, never sent to the frontend, never logged.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").optional(),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required").optional(),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  CORS_ORIGIN: z.string().default(defaultCorsOrigin),
  APP_PUBLIC_URL: z.string().url().optional(),
  COOKIE_SECURE: z.boolean().default(isProd),
  COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default(isProd ? "none" : "strict"),
  SUPERADMIN_EMAIL: z.string().email().default("admin@housing-society.local"),
  SUPERADMIN_PASSWORD: z.string().min(1, "SUPERADMIN_PASSWORD is required"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL").optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "SUPABASE_PUBLISHABLE_KEY is required").optional(),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required").optional(),
  SUPABASE_JWKS_URL: z.string().url("SUPABASE_JWKS_URL must be a valid URL").optional(),
  HEALTH_CHECK_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  SMTP_SECURE: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1"),
});

const parsed = envSchema.safeParse({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
  COOKIE_SECURE: process.env.COOKIE_SECURE,
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL,
  HEALTH_CHECK_TOKEN: process.env.HEALTH_CHECK_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM,
  SMTP_SECURE: process.env.SMTP_SECURE,
});

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`\n❌ Environment validation failed:\n${errors}\n`);
  console.error("Please check your .env file. See .env.example for the expected format.\n");
  process.exit(1);
}

// Safety guard: automated tests must never be able to write to the migrated
// schema. They run against a dedicated test schema, selected by adding
// `?schema=<name>` to the connection string. If NODE_ENV=test but the URL
// still targets `public`, stop rather than corrupt real data.
if (nodeEnv === "test") {
  const schemaOf = (value) => {
    if (!value) return null;
    const [, query] = String(value).split("?");
    return new URLSearchParams(query || "").get("schema") || "public";
  };
  const runtimeUrl = process.env.DATABASE_URL || null;
  const schema = schemaOf(runtimeUrl);
  if (!runtimeUrl) {
    console.error("\n❌ NODE_ENV=test but DATABASE_URL is not set. Refusing to run tests.\n");
    process.exit(1);
  }
  if (schema === "public") {
    console.error(
      "\n❌ Refusing to run tests against the public schema.\n" +
        "   Automated tests must use an isolated schema. Run them with:\n" +
        "     npm test            (uses scripts/runTests.js, schema = test)\n" +
        "   or set TEST_DATABASE_SCHEMA and add `?schema=<name>` to DATABASE_URL.\n"
    );
    process.exit(1);
  }
}

const env = {
  PORT: parsed.data.PORT,
  NODE_ENV: parsed.data.NODE_ENV,
  DATABASE_URL: parsed.data.DATABASE_URL || null,
  DIRECT_URL: parsed.data.DIRECT_URL || null,
  JWT_ACCESS_SECRET: parsed.data.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: parsed.data.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: parsed.data.JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY: parsed.data.JWT_REFRESH_EXPIRY,
  CORS_ORIGIN: parsed.data.CORS_ORIGIN,
  APP_PUBLIC_URL: parsed.data.APP_PUBLIC_URL || null,
  COOKIE_SECURE: parsed.data.COOKIE_SECURE,
  COOKIE_SAME_SITE: parsed.data.COOKIE_SAME_SITE,
  SUPERADMIN_EMAIL: parsed.data.SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD: parsed.data.SUPERADMIN_PASSWORD,
  SUPABASE_URL: parsed.data.SUPABASE_URL || null,
  SUPABASE_PUBLISHABLE_KEY: parsed.data.SUPABASE_PUBLISHABLE_KEY || null,
  SUPABASE_SECRET_KEY: parsed.data.SUPABASE_SECRET_KEY || null,
  SUPABASE_JWKS_URL: parsed.data.SUPABASE_JWKS_URL || null,
  HEALTH_CHECK_TOKEN: parsed.data.HEALTH_CHECK_TOKEN || null,
  CRON_SECRET: parsed.data.CRON_SECRET || null,
  SMTP_HOST: parsed.data.SMTP_HOST || null,
  SMTP_PORT: parsed.data.SMTP_PORT || 587,
  SMTP_USER: parsed.data.SMTP_USER || null,
  SMTP_PASS: parsed.data.SMTP_PASS || null,
  MAIL_FROM: parsed.data.MAIL_FROM || null,
  SMTP_SECURE: Boolean(parsed.data.SMTP_SECURE),
  isDev: !isProd,
  isProd,
  isVercel,
};

module.exports = env;
