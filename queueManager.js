// queueManager.js
const config = require("./config.json");
const { getRandomCooldown } = require("./cooldown");
const { logWithTime, logError } = require("./logger");

// Stores queues per channel
const messageQueues = {};
const cooldownActive = {};
const watchdogTimers = {};

/**
 * Process the queue for a given channel
 * @param {string} channelPlain
 * @param {object} client - tmi.js client
 * @param {function} safeSendMessage - function to safely send messages
 */
async function processQueue(channelPlain, client, safeSendMessage) {
  if (!messageQueues[channelPlain] || messageQueues[channelPlain].length === 0 || cooldownActive[channelPlain]) return;

  cooldownActive[channelPlain] = true;
  const message = messageQueues[channelPlain].shift();

  const cooldownTime = config.useRandomCooldown
    ? getRandomCooldown(config.cooldownMin, config.cooldownMax)
    : config.cooldown;

  const nextSendTime = new Date(Date.now() + cooldownTime).toLocaleTimeString();
  logWithTime(`[${channelPlain}] Cooldown: ${cooldownTime}ms, next message at ${nextSendTime}`);
  if (messageQueues[channelPlain].length > 0) {
    logWithTime(`[${channelPlain}] Messages remaining in queue: ${messageQueues[channelPlain].length}`);
  }

  // Watchdog logic
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

  // Schedule message send after cooldown
  setTimeout(async () => {
    try {
      await safeSendMessage(channelPlain, client, message);
    } catch (err) {
      logError(`[${channelPlain}] Message send failed: ${err.message}`);
    } finally {
      cooldownActive[channelPlain] = false;
      // Recursively process remaining messages
      processQueue(channelPlain, client, safeSendMessage);
    }
  }, cooldownTime);
}

/**
 * Queue a message for a channel
 * @param {string} channelPlain
 * @param {string} message
 * @param {object} client - tmi.js client
 * @param {function} safeSendMessage - function to safely send messages
 */
function queueMessage(channelPlain, message, client, safeSendMessage) {
  if (!messageQueues[channelPlain]) messageQueues[channelPlain] = [];
  messageQueues[channelPlain].push(message);
  processQueue(channelPlain, client, safeSendMessage);
}

module.exports = {
  cooldownActive,
  watchdogTimers,
  processQueue,
  queueMessage
};
