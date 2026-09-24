const RecoveryService = require("./service");

let timer = null;
let running = false;

async function runRecoveryJob() {
  if (running) return;
  running = true;
  try {
    const result = await RecoveryService.runAutoBlockCheck({ force: true });
    console.log(`[recovery] auto-block check: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error("[recovery] auto-block check failed:", error.message);
  } finally {
    running = false;
  }
}

function startRecoveryScheduler() {
  if (process.env.RECOVERY_JOB_ENABLED === "false") {
    console.log("[recovery] scheduler disabled by RECOVERY_JOB_ENABLED=false");
    return;
  }
  if (timer) return;
  runRecoveryJob();
  timer = setInterval(runRecoveryJob, 24 * 60 * 60 * 1000);
  timer.unref?.();
  console.log("[recovery] daily auto-block scheduler started");
}

function stopRecoveryScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { runRecoveryJob, startRecoveryScheduler, stopRecoveryScheduler };
