const fetch = require("node-fetch");
const config = require("./config.json");

let accessToken = null;

/**
 * Get Twitch App Access Token
 */
async function getAppAccessToken() {
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${config.clientId}&client_secret=${config.clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch token: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    accessToken = data.access_token;
    return accessToken;
  } catch (err) {
    console.error("[Twitch API] Failed to get access token:", err.message);
    throw err;
  }
}

/**
 * Check if a streamer is live and matches category.
 * Retries transient network errors up to `retries` times.
 * @param {string} channel - Twitch username
 * @param {boolean} retryToken - whether to retry token refresh
 * @param {number} retries - number of network retries remaining
 * @returns {boolean} true if live (and category matches if configured)
 */
async function isLiveAndCategory(channel, retryToken = true, retries = 3) {
  if (!accessToken) await getAppAccessToken();

  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${channel}`,
      {
        headers: {
          "Client-ID": config.clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Token expired, refresh once
    if (res.status === 401 && retryToken) {
      console.warn(`[${channel}] Token expired, refreshing...`);
      await getAppAccessToken();
      return isLiveAndCategory(channel, false, retries);
    }

    if (!res.ok) {
      console.error(`[${channel}] Twitch API error: ${res.status} ${res.statusText}`);
      return false;
    }

    const data = await res.json();

    if (!data.data || data.data.length === 0) return false;

    const stream = data.data[0];

    if (!config.checkCategory) return true;
    return stream.game_name.toLowerCase() === config.targetCategory.toLowerCase();
  } catch (err) {
    if (retries > 0) {
      console.warn(`[${channel}] Twitch API network error, retrying... (${retries} left)`, err.message);
      await new Promise((r) => setTimeout(r, 2000)); // wait 2 sec before retry
      return isLiveAndCategory(channel, retryToken, retries - 1);
    } else {
      console.error(`[${channel}] Twitch API failed after retries:`, err.message);
      return false; // fail-safe
    }
  }
}

module.exports = { getAppAccessToken, isLiveAndCategory };
