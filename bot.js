const tmi = require("tmi.js");
const config = require("./config.json");
const { getStats, saveStats, logPullRaw, logError } = require("./statsManager");
const { getRandomCooldown } = require("./cooldown");
const cron = require("node-cron");
const { initWorkbook, logToExcel } = require("./excelLogger");
const { sendWebhook } = require("./discordNotifier");
const { getAppAccessToken, isLiveAndCategory } = require("./twitchApi");

// ----------------- Helper for timestamped logging -----------------
function logWithTime(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

// ----------------- State -----------------
const waitingForMention = {}; // true/false per channel
const messageQueue = {};      // queued messages per channel
const streamerStats = {};

(async function main() {
  await initWorkbook();
  await getAppAccessToken();

  for (const ch of config.channels) {
    const c = ch.toLowerCase();
    streamerStats[c] = getStats(c);
    waitingForMention[c] = true;
    messageQueue[c] = [];
  }

  const client = new tmi.Client({
    identity: { username: config.botUsername, password: config.oauthToken },
    channels: config.channels.map(c => `#${c}`)
  });

  client.connect().catch(err => logError(err));

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
      await sendWebhook(`📊 Daily Summary - ${channel}`, description);
      logWithTime(`[${channel}] Daily summary sent`);
    }
  }

  await sendDailySummary();

  // Schedule daily summary
  cron.schedule("59 23 * * *", async () => {
    logWithTime("Running scheduled daily summary...");
    await sendDailySummary();
    for (const ch of config.channels) {
      const channel = ch.toLowerCase();
      const stats = getStats(channel);
      stats.daily = { totalPulls:0, totalGold:0, highestGold:0, highestWeight:0, heaviestFish:"", rarityCounts:{} };
      saveStats(channel, stats);
      logWithTime(`[${channel}] Daily stats reset`);
    }
  });

  // ----------------- On connect -----------------
  client.on("connected", async () => {
    logWithTime(`Bot connected as ${config.botUsername}`);
    for (const ch of config.channels) {
      const c = ch.toLowerCase();
      try {
        const live = await safeIsLiveAndCategory(c);
        if (live) {
          await client.say(`#${c}`, config.message);
          logWithTime(`[${c}] First message sent`);
        } else {
          logWithTime(`[${c}] Streamer not live or category mismatch.`);
        }
      } catch (err) {
        logWithTime(`[${c}] Error sending first message: ${err.message}`);
      }
    }
  });

  // ----------------- Cooldown queue helpers -----------------
  const processQueue = async (channelPlain) => {
    if (messageQueue[channelPlain].length === 0) {
      waitingForMention[channelPlain] = true;
      return;
    }

    waitingForMention[channelPlain] = false;
    const msg = messageQueue[channelPlain].shift();

    const cooldownTime = config.useRandomCooldown
      ? getRandomCooldown(config.cooldownMin, config.cooldownMax)
      : config.cooldown;

    const nextSendTime = new Date(Date.now() + cooldownTime).toLocaleTimeString();
    logWithTime(`[${channelPlain}] Cooldown before next !fish: ${cooldownTime}ms, will send at ${nextSendTime}`);

    setTimeout(async () => {
      try {
        const live = await safeIsLiveAndCategory(channelPlain);
        if (live) {
          await client.say(`#${channelPlain}`, config.message);
          logWithTime(`[${channelPlain}] Message sent after cooldown`);
        } else {
          logWithTime(`[${channelPlain}] Streamer not live or category mismatch, skipping message`);
        }
      } catch (err) {
        logWithTime(`[${channelPlain}] Error sending message after cooldown: ${err.message}`);
      } finally {
        // After sending, process next item in queue if any
        processQueue(channelPlain);
      }
    }, cooldownTime);
  };

  // ----------------- On message -----------------
  client.on("message", async (channel, tags, message, self) => {
    if (self) return;
    const channelPlain = channel.replace(/^#/, "").toLowerCase();
    const sender = tags.username?.toLowerCase();
    const cleanMsg = message.toLowerCase();

    if (
      config.triggerUsers.includes(sender) &&
      cleanMsg.includes(config.triggerMention.toLowerCase()) &&
      cleanMsg.includes("you caught")
    ) {
      logWithTime(`[${channelPlain}] Trigger mention detected from ${sender}`);
      logPullRaw(channelPlain, message);

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

      // Update stats
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

      await logToExcel(channelPlain, {
        timestamp: new Date().toLocaleTimeString(),
        rarity, stars, fishName, weight, gold,
        totalGold: stats.daily.totalGold,
        heaviestFish: stats.daily.heaviestFish,
        highestWeight: stats.daily.highestWeight
      });

      // Add to queue and process if free
      messageQueue[channelPlain].push(message);
      if (waitingForMention[channelPlain]) {
        processQueue(channelPlain);
      }
    }
  });
})();

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
      logWithTime(`[${channel}] Twitch API failed after retries: ${err.message}`);
      return false;
    }
  }
}
