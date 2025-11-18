// bot.js
const tmi = require("tmi.js");
const cron = require("node-cron");
const config = require("./config.json");
const { getStats, saveStats, logPullRaw } = require("./statsManager");
const { initWorkbook, logToExcel } = require("./excelLogger");
const { sendWebhook } = require("./discordNotifier");
const { getAppAccessToken, isLiveAndCategory, validateOAuthToken } = require("./twitchApi");
const { logWithTime, logError } = require("./logger");
const { queueFish } = require("./queueManager");

// ----------------- Config Validation -----------------
function validateConfig() {
  const requiredKeys = ["botUsername", "oauthToken", "channels", "clientId", "clientSecret"];
  for (const key of requiredKeys) {
    if (!config[key]) throw new Error(`Config missing required key: ${key}`);
  }
  if (config.cooldownMin > config.cooldownMax) throw new Error(`Config cooldownMin > cooldownMax`);
  if (!Array.isArray(config.targetCategory) && typeof config.targetCategory !== "string") {
    throw new Error(`Config targetCategory must be string or array`);
  }
}
validateConfig();

// ----------------- State -----------------
const streamerStats = {};
const liveCache = {}; // { channel: { live: bool, lastChecked: timestamp } }

// ----------------- Safe Twitch wrapper -----------------
async function safeIsLiveAndCategory(channel, retries = 2) {
  try {
    return await isLiveAndCategory(channel);
  } catch (err) {
    if (retries > 0) {
      logWithTime(`[${channel}] Twitch API error, retrying... ${err.message}`);
      await new Promise(r => setTimeout(r, 2000));
      return safeIsLiveAndCategory(channel, retries - 1);
    } else {
      logError(`[${channel}] Twitch API failed after retries: ${err.message}`);
      if (config.discordWebhook) await sendWebhook("⚠️ Twitch API Error", `[${channel}] ${err.message}`);
      return false;
    }
  }
}

// ----------------- Safe message sender -----------------
async function safeSendMessage(channelPlain, client, msg = config.message) {
  if (!liveCache[channelPlain]?.live) {
    logWithTime(`[${channelPlain}] Streamer not live, skipping message`);
    return;
  }
  try {
    await client.say(`#${channelPlain}`, msg);
    logWithTime(`[${channelPlain}] Message sent: ${msg}`);
  } catch (err) {
    logError(`[${channelPlain}] Error sending message: ${err.message}`);
    if (config.discordWebhook) await sendWebhook("⚠️ Bot Message Error", `[${channelPlain}] ${err.message}`);
  }
}

// ----------------- Heartbeat -----------------
if (config.heartbeatIntervalHours) {
  setInterval(async () => {
    logWithTime("💓 Bot heartbeat check: alive");
    if (config.discordWebhook) await sendWebhook("Bot Heartbeat", "Bot is alive and running ✅");
  }, config.heartbeatIntervalHours * 60 * 60 * 1000);
}

// ----------------- Main -----------------
(async function main() {
  try {
    // Validate OAuth token
    const validation = await validateOAuthToken(config.oauthToken);
    if (!validation.valid) {
      logError(`OAuth token invalid: ${validation.error}`);
      if (config.discordWebhook) await sendWebhook("⚠️ Bot Error", `OAuth token invalid: ${validation.error}`);
      process.exit(1);
    } else logWithTime(`OAuth token valid for user: ${validation.login}`);

    await initWorkbook();
    await getAppAccessToken();

    // Initialize state
    for (const ch of config.channels) {
      const c = ch.toLowerCase();
      streamerStats[c] = getStats(c);
      liveCache[c] = { live: false, lastChecked: 0 };
    }

    const client = new tmi.Client({
      identity: { username: config.botUsername, password: config.oauthToken },
      channels: config.channels.map(c => `#${c}`)
    });
    client.connect().catch(err => {
      logError(`Failed to connect TMI client: ${err.message}`);
      if (config.discordWebhook) sendWebhook("⚠️ Bot Connection Error", err.message);
    });

    // ----------------- Live polling -----------------
    async function pollLiveStatus(channel) {
      const live = await safeIsLiveAndCategory(channel);
      liveCache[channel] = { live, lastChecked: Date.now() };
      logWithTime(`[${channel}] Live status: ${live ? "LIVE" : "OFFLINE"}`);
    }
    for (const ch of config.channels) {
      const c = ch.toLowerCase();
      pollLiveStatus(c);
      setInterval(() => pollLiveStatus(c), config.livePollingInterval || 600_000);
    }

    // ----------------- Daily summary -----------------
    async function sendDailySummary() {
      const today = new Date().toLocaleDateString();
      for (const ch of config.channels) {
        const channel = ch.toLowerCase();
        const stats = getStats(channel);
        const description = `
📅 Date: ${today}
**Daily Summary**
- Total Pulls: ${stats.daily.totalPulls}
- Total Gold: ${stats.daily.totalGold}
- Highest Gold: ${stats.daily.highestGold}
- Heaviest Fish: ${stats.daily.heaviestFish} (${stats.daily.highestWeight}kg)

**All-Time Stats**
- Total Pulls: ${stats.allTime.totalPulls}
- Total Gold: ${stats.allTime.totalGold}
- Heaviest Fish: ${stats.allTime.heaviestFish} (${stats.allTime.heaviestWeight}kg)
        `;
        if (config.discordWebhook) await sendWebhook(`📊 Daily Summary - ${channel}`, description);
        logWithTime(`[${channel}] Daily summary sent`);
      }
    }
    await sendDailySummary();

    cron.schedule("59 23 * * *", async () => {
      logWithTime("Running scheduled daily summary...");
      await sendDailySummary();
      for (const ch of config.channels) {
        const channel = ch.toLowerCase();
        const stats = getStats(channel);
        stats.daily = { totalPulls: 0, totalGold: 0, highestGold: 0, highestWeight: 0, heaviestFish: "", rarityCounts: {} };
        saveStats(channel, stats);
        logWithTime(`[${channel}] Daily stats reset`);
      }
    });

    // ----------------- On connect -----------------
    client.on("connected", async () => {
      logWithTime(`Bot connected as ${config.botUsername}`);
      for (const ch of config.channels) {
        const c = ch.toLowerCase();
        if (liveCache[c]?.live) queueFish(c, client, safeSendMessage); // send !fish immediately
      }
    });

    // ----------------- On message -----------------
    client.on("message", async (channel, tags, message, self) => {
      if (self) return;
      const channelPlain = channel.replace(/^#/, "").toLowerCase();
      const sender = tags.username?.toLowerCase();
      const cleanMsg = message.toLowerCase();

      // Trigger detection (catch event)
      if (
        config.triggerUsers.includes(sender) &&
        cleanMsg.includes(config.triggerMention.toLowerCase()) &&
        cleanMsg.includes("you caught")
      ) {
        logWithTime(`[${channelPlain}] Trigger mention detected from ${sender}`);
        logPullRaw(channelPlain, message);

        // Parse catch info
        const regex = /you caught a ([^\d]+) weighing ([\d.]+)kg worth (\d+) gold/i;
        const match = message.match(regex);
        if (!match) return;

        const fullRarityFish = match[1].trim();
        const weight = parseFloat(match[2]);
        const gold = parseInt(match[3], 10);

        let parts = fullRarityFish.split(" ");
        const rarity = parts[0].toLowerCase();
        let stars = "", fishName = "";
        for (let i = 1; i < parts.length; i++) {
          if (parts[i].includes("⭐")) stars = parts[i];
          else fishName += (fishName ? " " : "") + parts[i];
        }

        const stats = streamerStats[channelPlain];
        stats.daily.totalPulls += 1;
        stats.daily.totalGold += gold;
        if (gold > stats.daily.highestGold) stats.daily.highestGold = gold;
        if (weight > stats.daily.highestWeight) {
          stats.daily.highestWeight = weight;
          stats.daily.heaviestFish = `${rarity}${stars} ${fishName}`;
        }
        stats.allTime.totalPulls += 1;
        stats.allTime.totalGold += gold;
        if (weight > stats.allTime.heaviestWeight) {
          stats.allTime.heaviestWeight = weight;
          stats.allTime.heaviestFish = `${rarity}${stars} ${fishName}`;
        }
        stats.daily.rarityCounts[rarity + stars] = (stats.daily.rarityCounts[rarity + stars] || 0) + 1;
        saveStats(channelPlain, stats);

        // Log to Excel
        await logToExcel(channelPlain, {
          timestamp: new Date().toLocaleTimeString(),
          rarity, stars, fishName, weight, gold,
          totalGold: stats.daily.totalGold,
          heaviestFish: stats.daily.heaviestFish,
          highestWeight: stats.daily.highestWeight
        });

        // ----------------- Queue !fish -----------------
        queueFish(channelPlain, client, safeSendMessage);

        // ----------------- High gold alert -----------------
        if (gold >= config.highGoldAlert) {
          const alertMsg = `🔥 ${sender} just caught ${fullRarityFish} worth ${gold} gold!`;
          logWithTime(`[${channelPlain}] High gold alert: ${alertMsg}`);
          if (config.discordWebhook) await sendWebhook("💰 High Gold Alert", alertMsg);
          await safeSendMessage(channelPlain, client, alertMsg);
        }
      }
    });

  } catch (err) {
    logError(`Fatal error in main: ${err.message}`);
    if (config.discordWebhook) await sendWebhook("⚠️ Bot Fatal Error", err.message);
    process.exit(1);
  }
})();
