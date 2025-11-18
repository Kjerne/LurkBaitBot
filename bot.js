const tmi = require("tmi.js");
const config = require("./config.json");
const { getStats, saveStats, logPullRaw, logError } = require("./statsManager");
const { getRandomCooldown } = require("./cooldown");
const cron = require("node-cron");

// Replace with your own Twitch API / Excel / Discord helper functions if needed
const { initWorkbook, logToExcel } = require("./excelLogger");
const { sendWebhook } = require("./discordNotifier");
const { isLiveAndCategory, getAppAccessToken } = require("./twitchApi");

const waitingForMention = {};
const streamerStats = {};

(async function main() {
  await initWorkbook();
  await getAppAccessToken();

  for (const ch of config.channels) {
    const c = ch.toLowerCase();
    streamerStats[c] = getStats(c);
    waitingForMention[c] = true;
  }

  const client = new tmi.Client({
    identity: { username: config.botUsername, password: config.oauthToken },
    channels: config.channels.map(c => `#${c}`)
  });

  client.connect().catch(logError);

  // Daily summary function
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
      console.log(`[${channel}] Daily summary sent`);
    }
  }

  // Send summary on startup
  await sendDailySummary();

  // Schedule daily summary at 23:59 and reset daily stats
  cron.schedule("59 23 * * *", async () => {
    console.log("Running scheduled daily summary...");
    await sendDailySummary();
    for (const ch of config.channels) {
      const channel = ch.toLowerCase();
      const stats = getStats(channel);
      stats.daily = {
        totalPulls: 0,
        totalGold: 0,
        highestGold: 0,
        highestWeight: 0,
        heaviestFish: "",
        rarityCounts: {}
      };
      saveStats(channel, stats);
      console.log(`[${channel}] Daily stats reset`);
    }
  });

  client.on("connected", async () => {
    console.log(`Bot connected as ${config.botUsername}`);
    for (const ch of config.channels) {
      const c = ch.toLowerCase();
      if (await isLiveAndCategory(c)) {
        await client.say(`#${c}`, config.message);
        console.log(`[${c}] First message sent`);
      } else {
        console.log(`[${c}] Streamer not live or category mismatch.`);
      }
    }
  });

  client.on("message", async (channel, tags, message, self) => {
    if (self) return;
    const channelPlain = channel.replace(/^#/, "").toLowerCase();
    const sender = tags.username?.toLowerCase();
    const cleanMsg = message.toLowerCase();

    if (config.triggerUsers.includes(sender) &&
        cleanMsg.includes(config.triggerMention.toLowerCase()) &&
        cleanMsg.includes("you caught")) {

      console.log(`[${channelPlain}] Trigger mention detected from ${sender}`);
      logPullRaw(channelPlain, message);

      const regex = /you caught a ([^\d]+) weighing ([\d.]+)kg worth (\d+) gold/i;
      const match = message.match(regex);
      if (!match) return;

      const fullRarityFish = match[1].trim();
      const weight = parseFloat(match[2]);
      const gold = parseInt(match[3],10);

      let parts = fullRarityFish.split(" ");
      const rarity = parts[0].toLowerCase();
      let stars = "", fishName = "";
      for(let i=1;i<parts.length;i++){
        if(parts[i].includes("⭐")) stars = parts[i];
        else fishName += (fishName ? " " : "") + parts[i];
      }

      const stats = streamerStats[channelPlain];

      // Update daily stats
      stats.daily.totalPulls += 1;
      stats.daily.totalGold += gold;
      if (gold > stats.daily.highestGold) stats.daily.highestGold = gold;
      if (weight > stats.daily.highestWeight) {
        stats.daily.highestWeight = weight;
        stats.daily.heaviestFish = `${rarity}${stars} ${fishName}`;
      }

      // Update all-time stats
      stats.allTime.totalPulls += 1;
      stats.allTime.totalGold += gold;
      if (weight > stats.allTime.heaviestWeight) {
        stats.allTime.heaviestWeight = weight;
        stats.allTime.heaviestFish = `${rarity}${stars} ${fishName}`;
      }

      stats.daily.rarityCounts[rarity+stars] = (stats.daily.rarityCounts[rarity+stars] || 0) + 1;

      saveStats(channelPlain, stats); // Save only after a real pull

      await logToExcel(channelPlain, {
        timestamp: new Date().toLocaleTimeString(),
        rarity, stars, fishName, weight, gold,
        totalGold: stats.daily.totalGold,
        heaviestFish: stats.daily.heaviestFish,
        highestWeight: stats.daily.highestWeight
      });

      // Cooldown logic with toggle
      if (waitingForMention[channelPlain]) {
        waitingForMention[channelPlain] = false;

        let cooldownTime = config.cooldown;
        if (config.useRandomCooldown) {
          cooldownTime = getRandomCooldown(config.cooldownMin, config.cooldownMax);
        }

        console.log(`[${channelPlain}] Cooldown before next !fish: ${cooldownTime}ms`);

        setTimeout(async () => {
          try {
            if (await isLiveAndCategory(channelPlain)) {
              await client.say(`#${channelPlain}`, config.message);
              console.log(`[${channelPlain}] Message sent after cooldown`);
            } else {
              console.log(`[${channelPlain}] Streamer not live or category mismatch, skipping message`);
            }
          } catch (err) {
            console.error(err);
          } finally {
            waitingForMention[channelPlain] = true;
          }
        }, cooldownTime);
      }
    }
  });
})();
