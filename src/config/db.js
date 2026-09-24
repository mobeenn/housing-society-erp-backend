const fileDB = require("./fileDb");
const env = require("./env");

/**
 * Initialize database connection
 * Currently using file-based storage
 * Will be replaced with PostgreSQL in the future
 */
const connectDB = async () => {
  try {
    await fileDB.init();
    console.log(`🗄️  Using file-based database (temporary)`);
    console.log(`📝 Database file: ${fileDB.storagePath}`);

    if (env.isDev) {
      console.log(`⚠️  File-based storage active - PostgreSQL migration pending`);
    }
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    throw error;
  }
};

connectDB.connectDB = connectDB;
connectDB.db = fileDB;

module.exports = connectDB;
