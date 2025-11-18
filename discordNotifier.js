const fetch = require("node-fetch");
const config = require("./config.json");
const { logWithTime, logError } = require("./logger");

async function sendWebhook(title, message, color = 0x00ADEF) {
  if (!config.discordWebhook) return;
  try {
    const payload = { embeds: [{ title, description: message, color, timestamp: new Date().toISOString() }] };
    const res = await fetch(config.discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) logError(`Discord webhook failed: ${res.status} ${res.statusText}`, false);
  } catch (err) {
    logError(`Discord webhook error: ${err.message}`, false);
  }
}

module.exports = { sendWebhook };
