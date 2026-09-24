const app = require("../src/app");
const { ensureDatabaseReady } = require("../src/config/bootstrap");

let appHandler;

module.exports = async (request, response) => {
  try {
    await ensureDatabaseReady();
    appHandler ||= app;
    return appHandler(request, response);
  } catch (error) {
    console.error("Vercel initialization failed:", error);
    if (response.headersSent) return response.end();
    return response.status(503).json({
      success: false,
      message: "Ephemeral demo storage is initializing. Please retry shortly.",
      errors: [],
    });
  }
};
