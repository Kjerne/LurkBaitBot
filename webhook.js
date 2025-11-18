const { getStats } = require("./statsManager");
const { sendWebhook } = require("./discordNotifier");
const { logWithTime, logError } = require("./logger");
const config = require("./config.json");

(async function sendManual() {
  try {
    const today = new Date().toLocaleDateString();

    for (const ch of config.channels) {
      const channel = ch.toLowerCase();
      const stats = getStats(channel);

      const description = `
📅 **Date:** ${today}
**Daily Summary (manual trigger)**:
- Total Pulls: ${stats.daily.totalPulls}
- Total Gold: ${stats.daily.totalGold}
- Highest Gold: ${stats.daily.highestGold}
- Heaviest Fish: ${stats.daily.heaviestFish} (${stats.daily.highestWeight}kg)

**All-Time Stats**:
- Total Pulls: ${stats.allTime.totalPulls}
- Total Gold: ${stats.allTime.totalGold}
- Heaviest Fish: ${stats.allTime.heaviestFish} (${stats.allTime.heaviestWeight}kg)
      `;

      if (config.discordWebhook) {
        await sendWebhook(`📊 Daily Summary - ${channel}`, description);
        logWithTime(`[${channel}] Manual daily summary sent`);
      } else {
        logWithTime(`[${channel}] Discord webhook not configured, summary skipped`);
      }
    }
  } catch (err) {
    logError(`Failed to send manual webhook summary: ${err.message}`);
  }
})();
