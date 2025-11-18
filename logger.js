// logger.js
const config = require("./config.json");

/**
 * Log a message with timestamp
 * @param {string} message
 */
function logWithTime(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Log an error with timestamp.
 * Optional Discord alert should be called from bot.js
 * @param {string} message - Error message
 */
function logError(message) {
  logWithTime(`ERROR: ${message}`);
}

module.exports = { logWithTime, logError };
