import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    // Supabase does not allow migrations through the transaction pooler (port 6543).
    // Use DIRECT_URL (port 5432) for Prisma CLI operations (migrations, introspection).
    url: env("DIRECT_URL"),
  },
});
