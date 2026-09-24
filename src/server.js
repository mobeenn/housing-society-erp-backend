const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const { startRecoveryScheduler } = require("./modules/recovery/recovery.job");

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();
  startRecoveryScheduler();

  app.listen(env.PORT, () => {
    console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`   Health check → http://localhost:${env.PORT}/api/health`);
  });
};

startServer();
