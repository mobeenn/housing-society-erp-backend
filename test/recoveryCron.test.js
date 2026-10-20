/**
 * P1-5: Recovery cron endpoint requires CRON_SECRET.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");

const app = require("../src/app");
const env = require("../src/config/env");

let server;
let baseUrl;
let previousSecret;

function request(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let body = null;
          try {
            body = raw ? JSON.parse(raw) : null;
          } catch {
            body = raw;
          }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

before(async () => {
  previousSecret = env.CRON_SECRET;
  env.CRON_SECRET = "test-cron-secret-phase1";
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  env.CRON_SECRET = previousSecret;
  await new Promise((resolve) => server.close(resolve));
});

test("GET /api/recovery/cron/auto-block without secret returns 401", async () => {
  const res = await request("GET", "/api/recovery/cron/auto-block");
  assert.equal(res.status, 401);
});

test("GET /api/recovery/cron/auto-block with secret returns 200 summary", async () => {
  const res = await request("GET", "/api/recovery/cron/auto-block", {
    Authorization: "Bearer test-cron-secret-phase1",
  });
  assert.equal(res.status, 200);
  assert.equal(res.body?.success, true);
  assert.ok(res.body?.data);
});
