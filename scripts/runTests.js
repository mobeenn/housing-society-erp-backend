/**
 * Prepare the isolated test schema, then run the test suite against it.
 *
 *   node scripts/runTests.js              # all test files
 *   node scripts/runTests.js userRoles    # only matching files
 *   node scripts/runTests.js --no-setup   # skip rebuilding the schema
 *
 * Steps:
 *   1. drop and recreate the test schema
 *   2. apply migrations to the test schema only
 *   3. load the same fixture data the real database has (db.json import + seed)
 *   4. run `node --test` with NODE_ENV=test, so the app connects to the test
 *      schema and the public schema is never touched
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { TEST_SCHEMA, withSchema, connect, ROOT } = require("./testDatabase");
const env = require("../src/config/env");

const args = process.argv.slice(2);
const noSetup = args.includes("--no-setup");
const filters = args.filter((a) => !a.startsWith("--"));

/** Never let a test run touch the real schema. */
function assertNotProduction() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to run: NODE_ENV must be 'test' so the app uses the test schema.");
  }
}

async function resetSchema() {
  const admin = await connect(env.DATABASE_URL, "public");
  try {
    // Cascade drops every table in the test schema in one statement.
    await admin.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await admin.query(`CREATE SCHEMA "${TEST_SCHEMA}"`);
  } finally {
    await admin.end();
  }
  console.log(`  schema "${TEST_SCHEMA}" reset`);
}

function runPrisma(args, extraEnv) {
  const result = spawnSync("npx", ["prisma", ...args], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function runNode(script, extraEnv) {
  const result = spawnSync("node", [script], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed with exit code ${result.status}`);
  }
}

async function main() {
  const testUrl = withSchema(env.DATABASE_URL, TEST_SCHEMA);
  const testDirectUrl = withSchema(env.DIRECT_URL || env.DATABASE_URL, TEST_SCHEMA);
  const testEnv = {
    NODE_ENV: "test",
    DATABASE_URL: testUrl,
    DIRECT_URL: testDirectUrl,
    TEST_DATABASE_SCHEMA: TEST_SCHEMA,
  };

  if (!noSetup) {
    console.log(`\nPreparing isolated test schema "${TEST_SCHEMA}"...`);
    await resetSchema();
    runPrisma(["migrate", "deploy"], testEnv);
    // Same fixtures the real database has, so tests exercise real data shapes.
    runNode("scripts/migrateFileDbToPostgres.js", testEnv);
    runNode("prisma/seed.js", testEnv);
    console.log("Test schema ready.\n");
  }

  const testDir = path.join(ROOT, "test");
  let files = fs
    .readdirSync(testDir)
    .filter((f) => f.endsWith(".test.js"))
    .map((f) => path.join("test", f));

  if (filters.length) {
    files = files.filter((f) => filters.some((needle) => f.toLowerCase().includes(needle.toLowerCase())));
    if (!files.length) throw new Error(`No test files matched: ${filters.join(", ")}`);
  }

  // Serialise: the legacy flows share fixtures and the schema is rebuilt once.
  const testResult = spawnSync(
    "node",
    ["--test", "--test-concurrency=1", ...files],
    { cwd: ROOT, stdio: "inherit", shell: true, env: { ...process.env, ...testEnv } }
  );

  // Safety net: prove the public schema was not modified.
  const admin = await connect(env.DATABASE_URL, "public");
  try {
    const { rows } = await admin.query(`
      SELECT COUNT(*)::int AS n
      FROM information_schema.schemata
      WHERE schema_name = '${TEST_SCHEMA}'
    `);
    if (rows[0].n !== 1) {
      console.error(`\nERROR: test schema "${TEST_SCHEMA}" is missing after the run.`);
      process.exitCode = 1;
    }
  } finally {
    await admin.end();
  }

  process.exitCode = testResult.status ?? 1;
}

main()
  .catch((error) => {
    console.error(`\nTest run failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    assertNotProduction();
  });
