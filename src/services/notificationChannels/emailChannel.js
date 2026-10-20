const env = require("../../config/env");

let warnedMissingSmtp = false;
let transporter = null;

function smtpConfigured() {
  return Boolean(env.SMTP_HOST && String(env.SMTP_HOST).trim());
}

function getTransporter() {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    // Lazy require so the app still boots if the package is being installed.
    const nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: Boolean(env.SMTP_SECURE),
      auth: env.SMTP_USER
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS || "",
          }
        : undefined,
    });
  }
  return transporter;
}

class EmailNotificationChannel {
  constructor() {
    this.name = "email";
    this.provider = smtpConfigured() ? "smtp" : "stub";
  }

  /**
   * Provider-neutral email interface.
   * Uses nodemailer SMTP when SMTP_HOST is configured; otherwise stubs.
   */
  async send({ recipient, subject, message, metadata = {} }) {
    if (!smtpConfigured()) {
      if (!warnedMissingSmtp) {
        console.warn(
          "[email] SMTP_HOST is not configured — email channel is stubbed. Set SMTP_* env vars to enable real delivery."
        );
        warnedMissingSmtp = true;
      }
      return {
        channel: this.name,
        provider: "stub",
        status: "stubbed",
        accepted: false,
        recipient,
        subject,
        preview: message,
        metadata,
        sentAt: null,
      };
    }

    try {
      const transport = getTransporter();
      const info = await transport.sendMail({
        from: env.MAIL_FROM || env.SMTP_USER || "noreply@civica.local",
        to: recipient,
        subject: subject || "(no subject)",
        text: message || "",
      });
      return {
        channel: this.name,
        provider: "smtp",
        status: "sent",
        accepted: true,
        recipient,
        subject,
        preview: message,
        metadata: { ...metadata, messageId: info.messageId },
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.warn("[email] SMTP send failed:", error.message);
      return {
        channel: this.name,
        provider: "smtp",
        status: "failed",
        accepted: false,
        recipient,
        subject,
        preview: message,
        metadata: { ...metadata, error: error.message },
        sentAt: null,
      };
    }
  }
}

module.exports = EmailNotificationChannel;
