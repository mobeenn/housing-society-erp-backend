/**
 * P1-8: Email channel stubs without SMTP; SMTP path uses nodemailer when configured.
 */
const { test, after } = require("node:test");
const assert = require("node:assert");

const env = require("../src/config/env");
const EmailNotificationChannel = require("../src/services/notificationChannels/emailChannel");

const previousHost = env.SMTP_HOST;

after(() => {
  env.SMTP_HOST = previousHost;
});

test("email channel stubs when SMTP_HOST is unset", async () => {
  env.SMTP_HOST = null;
  // Fresh instance so provider reflects current env
  delete require.cache[require.resolve("../src/services/notificationChannels/emailChannel")];
  const Channel = require("../src/services/notificationChannels/emailChannel");
  const channel = new Channel();
  const result = await channel.send({
    recipient: "clerk@example.com",
    subject: "Test",
    message: "Hello",
  });
  assert.equal(result.status, "stubbed");
  assert.equal(result.accepted, false);
  assert.equal(result.provider, "stub");
});
