/**
 * Prisma client singleton for the Civica backend.
 *
 * Uses @prisma/adapter-pg (PrismaPg) with DATABASE_URL (pooled, runtime).
 * Guarded against multiple instances during nodemon reloads.
 */

// Generator output is configured in prisma/schema.prisma as
//   output = "../src/generated/prisma"
// which resolves to backend/src/generated/prisma. From this file
// (backend/src/config) that is "../generated/prisma/client".
const { PrismaClient } = require("../generated/prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const env = require("./env");

// Guard against multiple instances during nodemon reloads
const globalForPrisma = globalThis;

const createPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
};

const prisma = globalForPrisma.prisma || createPrismaClient();

if (env.isDev) {
  globalForPrisma.prisma = prisma;
}

module.exports = { prisma };
