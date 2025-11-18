const fs = require("fs");
const path = require("path");
const { logWithTime, logError } = require("./logger");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function defaultStats() {
  return {
    daily: { totalPulls: 0, totalGold: 0, highestGold: 0, highestWeight: 0, heaviestFish: "", rarityCounts: {} },
    allTime: { totalPulls: 0, totalGold: 0, heaviestFish: "", heaviestWeight: 0 }
  };
}

function getStats(streamer) {
  const file = path.join(DATA_DIR, `${streamer}.json`);
  let stats = defaultStats();
  if (fs.existsSync(file)) {
    try {
      const fileStats = JSON.parse(fs.readFileSync(file));
      stats.daily = Object.assign(stats.daily, fileStats.daily || {});
      stats.allTime = Object.assign(stats.allTime, fileStats.allTime || {});
      logWithTime(`[DEBUG] Loaded stats for ${streamer}`);
    } catch (err) {
      logError(`Error reading stats for ${streamer}, using defaults: ${err.message}`);
    }
  } else logWithTime(`[DEBUG] Stats file not found for ${streamer}, using defaults`);
  return stats;
}

function saveStats(streamer, stats) {
  const file = path.join(DATA_DIR, `${streamer}.json`);
  fs.writeFileSync(file, JSON.stringify(stats, null, 2));
}

function logPullRaw(streamer, message) {
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const file = path.join(logsDir, `pulls-${streamer}.txt`);
  fs.appendFileSync(file, `[${new Date().toLocaleString()}] ${message}\n`);
}

module.exports = { getStats, saveStats, logPullRaw, logError };
