const fetch = require("node-fetch");
const config = require("./config.json");

async function sendWebhook(title, message, color=0x00ADEF) {
  if (!config.discordWebhook) return;
  await fetch(config.discordWebhook, {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ embeds:[{title,description:message,color}] })
  });
}

module.exports = { sendWebhook };
