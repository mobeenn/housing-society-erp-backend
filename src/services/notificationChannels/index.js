const EmailNotificationChannel = require("./emailChannel");
const SmsNotificationChannel = require("./smsChannel");
const WhatsAppNotificationChannel = require("./whatsappChannel");

const channels = Object.freeze({
  email: new EmailNotificationChannel(),
  sms: new SmsNotificationChannel(),
  whatsapp: new WhatsAppNotificationChannel(),
});

/**
 * Stable integration boundary for future providers.
 * @param {"email"|"sms"|"whatsapp"} channelName
 * @param {{recipient:string, subject?:string, message:string, metadata?:object}} payload
 */
async function dispatchNotification(channelName, payload) {
  const channel = channels[channelName];
  if (!channel) {
    throw new Error(`Unsupported notification channel: ${channelName}`);
  }
  return channel.send(payload);
}

module.exports = {
  channels,
  dispatchNotification,
  EmailNotificationChannel,
  SmsNotificationChannel,
  WhatsAppNotificationChannel,
};
