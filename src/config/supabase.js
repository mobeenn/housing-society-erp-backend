/**
 * Supabase admin client for server-side operations.
 *
 * Uses @supabase/server core primitives (createAdminClient) as documented
 * in the package README. This client bypasses RLS and must NEVER be
 * imported from any file that can end up in frontend bundles.
 *
 * SUPABASE_SECRET_KEY bypasses RLS — server-side only, never sent to the
 * frontend, never logged.
 *
 * For now, this client is only used for Storage operations.
 * All relational data goes through Prisma.
 */

const { createAdminClient } = require("@supabase/server/core");
const env = require("./env");

// Validate required env vars at module load time
if (!env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required for Supabase admin client");
}
if (!env.SUPABASE_SECRET_KEY) {
  throw new Error("SUPABASE_SECRET_KEY is required for Supabase admin client");
}

/**
 * Server-side Supabase admin client.
 * Bypasses RLS. Use only for Storage operations.
 */
const supabaseAdmin = createAdminClient();

module.exports = supabaseAdmin;
