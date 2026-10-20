/**
 * Legacy Supabase JS client.
 *
 * Documents no longer use Supabase Storage (Vercel Blob in production,
 * local `uploads/` in development). Relational data uses Prisma/Postgres.
 * This module is kept only if an operator still needs ad-hoc Supabase admin
 * access; nothing in the request path imports it.
 */

const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  module.exports = null;
} else {
  module.exports = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
