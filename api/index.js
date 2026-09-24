const app = require("../src/app");
const { ensureDatabaseReady } = require("../src/config/bootstrap");
const { db } = require("../src/config/db");

let appHandler;

module.exports = async (request, response) => {
  try {
    await ensureDatabaseReady();
    await db.refresh();
    appHandler ||= app;
    return appHandler(request, response);
  } catch (error) {
    console.error("Vercel initialization failed:", error);
    if (response.headersSent) return response.end();
    const payload = JSON.stringify({
      success: false,
      message: "Persistent database storage is unavailable or initializing. Please retry shortly.",
      errors: [],
    });
    if (typeof response.status === "function") {
      return response.status(503).json(JSON.parse(payload));
    }
    response.statusCode = 503;
    response.setHeader("Content-Type", "application/json");
    return response.end(payload);
  }
};
