const { connectDB, db } = require("./db");
const { seed: seedRolesAndSuperAdmin } = require("../seeds/seedRolesAndSuperAdmin");
const { seed: seedAdministration } = require("../seeds/seedAdministration");
const { seedRbac } = require("../seeds/seedRbacModules");
const { seedRecoveryAccess } = require("../seeds/seedRecoveryAccess");
const { seedHrPayrollAccess } = require("../seeds/seedHrPayrollAccess");
const { seedPhase15Access } = require("../seeds/seedPhase15Access");

let readinessPromise = null;

async function initializePersistentData() {
  await connectDB();

  // Every seeder is idempotent. Existing imported data is preserved; only
  // missing base roles, settings, and RBAC records are created.
  await seedRolesAndSuperAdmin();
  await seedAdministration();
  await seedRbac();
  await seedRecoveryAccess();
  await seedHrPayrollAccess();
  await seedPhase15Access();
  await db.save();

  console.log(`✅ Persistent application data ready (${db.storageMode}).`);
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
