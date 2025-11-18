// queueManager.js
const config = require("./config.json");
const { getRandomCooldown } = require("./cooldown");
const { logWithTime, logError } = require("./logger");

// ----------------- Queues & state -----------------
const messageQueues = {};      // Stores message queue per channel
const cooldownActive = {};     // Tracks if cooldown is active per channel
const watchdogTimers = {};     // Watchdog timers per channel

/**
 * Process the message queue for a channel
 * @param {string} channelPlain
 * @param {object} client - tmi.js client
 * @param {function} safeSendMessage - function to safely send messages
 */
async function processQueue(channelPlain, client, safeSendMessage) {
  if (!messageQueues[channelPlain] || messageQueues[channelPlain].length === 0 || cooldownActive[channelPlain]) return;

  cooldownActive[channelPlain] = true;
  const message = messageQueues[channelPlain].shift(); // pop next message

  // Determine cooldown
  const cooldownTime = config.useRandomCooldown
    ? getRandomCooldown(config.cooldownMin, config.cooldownMax)
    : config.cooldown;

  const nextSendTime = new Date(Date.now() + cooldownTime).toLocaleTimeString();
  logWithTime(`[${channelPlain}] Cooldown: ${cooldownTime}ms, next message at ${nextSendTime}`);

  if (messageQueues[channelPlain].length > 0) {
    logWithTime(`[${channelPlain}] Messages remaining in queue: ${messageQueues[channelPlain].length}`);
  }

  // ----------------- Watchdog -----------------
  if (config.watchdogEnabled) {
    if (watchdogTimers[channelPlain]) clearTimeout(watchdogTimers[channelPlain]);
    watchdogTimers[channelPlain] = setTimeout(async () => {
      logWithTime(`[${channelPlain}] Watchdog triggered: resending message`);
      try {
        await safeSendMessage(channelPlain, client, message);
      } catch (err) {
        logError(`[${channelPlain}] Watchdog send failed: ${err.message}`);
      }
    }, cooldownTime + (config.watchdogHeadspace || 90_000));
  }

  // ----------------- Send message after cooldown -----------------
  setTimeout(async () => {
    try {
      await safeSendMessage(channelPlain, client, message);
    } catch (err) {
      logError(`[${channelPlain}] Message send failed: ${err.message}`);
    } finally {
      cooldownActive[channelPlain] = false;
      processQueue(channelPlain, client, safeSendMessage); // continue queue
    }
  }, cooldownTime);
}

/**
 * Queue a message to be sent
 * Always sends `!fish` instead of raw chat message.
 * @param {string} channelPlain
 * @param {object} client - tmi.js client
 * @param {function} safeSendMessage - function to safely send messages
 */
function queueFish(channelPlain, client, safeSendMessage) {
  if (!messageQueues[channelPlain]) messageQueues[channelPlain] = [];
  messageQueues[channelPlain].push(config.message); // always !fish
  processQueue(channelPlain, client, safeSendMessage);
}

module.exports = {
  cooldownActive,
  watchdogTimers,
  processQueue,
  queueFish
};
