const { prisma } = require("./prisma");
const { collection } = require("../db/prismaCollection");
const env = require("./env");

/**
 * Database entry point.
 *
 * The datastore is PostgreSQL via Prisma. `db.collection(name)` returns a
 * Prisma-backed adapter that speaks the legacy Mongo-shaped collection API, so
 * the service layer is unchanged while all reads and writes go to Postgres.
 *
 * data/db.json is no longer opened at runtime. It is retained only as the
 * source for scripts/migrateFileDbToPostgres.js (one-time import).
 */

const storageMode = "postgresql-prisma";

const db = {
  storageMode,
  storagePath: null,
  collection,

  // Legacy lifecycle hooks kept so `server.js` and the seeds need no changes.
  async init() {
    await prisma.$queryRaw`SELECT 1`;
    return this;
  },
  async save() {
    /* no-op: every write is persisted by Prisma immediately */
  },
  async refresh() {
    /* no-op: there is no in-process cache to refresh */
  },
};

/**
 * Verify the schema is actually reachable and report the table count.
 * Cheap enough to run on every boot.
 */
const connectDB = async () => {
  try {
    await db.init();
    const [{ count }] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    `;
 console.log(` Using PostgreSQL via Prisma`);
 console.log(` Tables available: ${count}`);
    if (env.isDev) {
 console.log(` Run \`npm run db:verify:import\` to compare Postgres against data/db.json`);
    }
  } catch (error) {
 console.error(" Database initialization failed:", error.message);
    throw error;
  }
};

connectDB.connectDB = connectDB;
connectDB.db = db;
connectDB.prisma = prisma;

module.exports = connectDB;
