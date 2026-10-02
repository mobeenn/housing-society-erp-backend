const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const { prisma } = require("./config/prisma");
const { startRecoveryScheduler } = require("./modules/recovery/recovery.job");
const { ensureDatabaseReady } = require("./config/bootstrap");

const startServer = async () => {
  if (env.isVercel) {
    await ensureDatabaseReady();
    await connectDB.db.refresh();
  } else {
    await connectDB();
    startRecoveryScheduler();
  }

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`   Health check → http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log("✅ Prisma disconnected");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();
