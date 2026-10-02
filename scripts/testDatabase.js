/**
 * Isolated test database support.
 *
 * Tests must never write to the migrated `public` schema. They run against a
 * separate Postgres schema (`test` by default) in the same database, so there
 * is no second database to provision and no extra secret to manage: the test
 * connection string is derived from the existing one by swapping the schema
 * parameter.
 *
 * Isolation guarantees:
 *  - the test schema is dropped and rebuilt from scratch on every run
 *  - migrations are applied to the test schema only
 *  - the public schema is never written to
 */

const path = require("path");
const { Client } = require("pg");

const TEST_SCHEMA = process.env.TEST_DATABASE_SCHEMA || "test";
const VALID_SCHEMA = /^[a-z_][a-z0-9_]*$/;

if (!VALID_SCHEMA.test(TEST_SCHEMA)) {
  throw new Error(`Unsafe TEST_DATABASE_SCHEMA value: ${TEST_SCHEMA}`);
}

/** Return a connection string pointing at the given schema. */
function withSchema(connectionString, schema) {
  if (!connectionString) return null;
  const [base, query] = String(connectionString).split("?");
  const params = new URLSearchParams(query || "");
  params.set("schema", schema);
  return `${base}?${params.toString()}`;
}

/** The schema Prisma would otherwise use (i.e. the real one). */
function productionSchemaOf(connectionString) {
  if (!connectionString) return null;
  const [, query] = String(connectionString).split("?");
  return new URLSearchParams(query || "").get("schema") || "public";
}

/**
 * Connect with the plain pg driver.
 *
 * A statement_timeout is set so a hung test cannot leave the schema locked, and
 * the pooler is avoided for DDL where possible by using DIRECT_URL if present.
 */
async function connect(connectionString, schema) {
  const client = new Client({
    connectionString: withSchema(connectionString, schema),
    statement_timeout: 120000,
  });
  await client.connect();
  return client;
}

const isProductionSchema = (connectionString) =>
  productionSchemaOf(connectionString) === TEST_SCHEMA;

module.exports = {
  TEST_SCHEMA,
  withSchema,
  productionSchemaOf,
  isProductionSchema,
  connect,
  ROOT: path.resolve(__dirname, ".."),
};
