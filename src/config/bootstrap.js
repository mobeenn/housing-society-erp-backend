const { connectDB, db } = require("./db");

/**
 * Serverless cold-start data readiness (Vercel).
 *
 * Uses the Prisma seed so the Postgres tables always contain the base rows.
 * The legacy fileDB seeders are no longer invoked: they wrote to data/db.json
 * and one of them would fall back to a hardcoded Super Admin password.
 */

let readinessPromise = null;

async function initializePersistentData() {
  await connectDB();

  // Idempotent upserts: existing imported data is preserved, only missing base
  // rows (modules, roles, numbering rules, settings, Super Admin) are created.
  const { run } = require("../../prisma/seed");
  await run();

  console.log(`Persistent application data ready (${db.storageMode}).`);
}

function ensureDatabaseReady() {
  if (!readinessPromise) {
    readinessPromise = initializePersistentData().catch((error) => {
      readinessPromise = null;
      throw error;
    });
  }
  return readinessPromise;
}

module.exports = { ensureDatabaseReady, initializePersistentData };
