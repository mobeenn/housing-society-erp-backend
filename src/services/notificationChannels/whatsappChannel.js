class WhatsAppNotificationChannel {
  constructor() {
    this.name = "whatsapp";
    this.provider = "stub";
  }

  /**
   * Provider-neutral WhatsApp interface.
   * No external provider is called in development.
   */
  async send({ recipient, message, metadata = {} }) {
    return {
      channel: this.name,
      provider: this.provider,
      status: "stubbed",
      accepted: false,
      recipient,
      preview: message,
      metadata,
      sentAt: null,
    };
  }
}

module.exports = WhatsAppNotificationChannel;
