/**
 * P0-2: Basic /api/health is public and opaque; /api/health/deep requires auth.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");

const app = require("../src/app");
const env = require("../src/config/env");

let server;
let baseUrl;

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
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/health returns opaque ok without DB details", async () => {
  const { status, body } = await request("GET", "/api/health");
  assert.equal(status, 200);
  assert.deepEqual(body, { status: "ok" });
  assert.equal(body.database, undefined);
  assert.equal(body.persistence, undefined);
  assert.equal(body.tables, undefined);
});

test("GET /api/health/deep without auth returns 401", async () => {
  const { status } = await request("GET", "/api/health/deep");
  assert.equal(status, 401);
});

test("GET /api/health/deep with wrong token returns 401", async () => {
  const { status } = await request("GET", "/api/health/deep", {
    "x-health-check-token": "definitely-not-the-real-token",
  });
  // Without a configured token (or with a mismatch), falls through to JWT auth → 401
  assert.ok(status === 401 || status === 403);
});

test("GET /api/health/deep accepts HEALTH_CHECK_TOKEN when configured", async (t) => {
  if (!env.HEALTH_CHECK_TOKEN) {
    t.skip("HEALTH_CHECK_TOKEN not set in test env");
    return;
  }
  const { status, body } = await request("GET", "/api/health/deep", {
    "x-health-check-token": env.HEALTH_CHECK_TOKEN,
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(body.data);
  assert.ok(["up", "down"].includes(body.data.database));
});
