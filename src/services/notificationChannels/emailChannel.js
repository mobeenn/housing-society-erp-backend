class EmailNotificationChannel {
  constructor() {
    this.name = "email";
    this.provider = "stub";
  }

  /**
   * Provider-neutral email interface.
   * Replace the implementation when SMTP/API credentials are supplied.
   */
  async send({ recipient, subject, message, metadata = {} }) {
    return {
      channel: this.name,
      provider: this.provider,
      status: "stubbed",
      accepted: false,
      recipient,
      subject,
      preview: message,
      metadata,
      sentAt: null,
    };
  }
}

module.exports = EmailNotificationChannel;
