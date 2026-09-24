const { connectDB, db } = require("./db");
const { seed: seedRolesAndSuperAdmin } = require("../seeds/seedRolesAndSuperAdmin");
const { seed: seedAdministration } = require("../seeds/seedAdministration");
const { seedRbac } = require("../seeds/seedRbacModules");
const { seedRecoveryAccess } = require("../seeds/seedRecoveryAccess");
const { seedHrPayrollAccess } = require("../seeds/seedHrPayrollAccess");
const { seedPhase15Access } = require("../seeds/seedPhase15Access");

let readinessPromise = null;

async function initializeEphemeralDemo() {
  await connectDB();

  // Every seeder is idempotent. On a warm Vercel instance these checks are
  // cheap; after /tmp is recycled they recreate the minimum usable workspace.
  await seedRolesAndSuperAdmin();
  await seedAdministration();
  await seedRbac();
  await seedRecoveryAccess();
  await seedHrPayrollAccess();
  await seedPhase15Access();
  await db.save();

  console.log(`✅ Ephemeral Vercel demo data ready (${db.storageMode}).`);
}

function ensureDatabaseReady() {
  if (!readinessPromise) {
    readinessPromise = initializeEphemeralDemo().catch((error) => {
      readinessPromise = null;
      throw error;
    });
  }
  return readinessPromise;
}

module.exports = { ensureDatabaseReady, initializeEphemeralDemo };
