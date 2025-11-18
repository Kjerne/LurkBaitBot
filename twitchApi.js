const fetch = require("node-fetch");
const config = require("./config.json");

let accessToken = null;

async function getAppAccessToken() {
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${config.clientId}&client_secret=${config.clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    const data = await res.json();
    accessToken = data.access_token;
  } catch (err) {
    console.error("[Twitch API] Failed to get access token:", err.message);
    throw err;
  }
}

async function isLiveAndCategory(channel, retry = true) {
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

    // If token expired, refresh once
    if (res.status === 401 && retry) {
      await getAppAccessToken();
      return isLiveAndCategory(channel, false);
    }

    const data = await res.json();

    // Stream offline or no data — silently return false
    if (!data.data || data.data.length === 0) return false;

    const stream = data.data[0];

    if (!config.checkCategory) return true;
    return stream.game_name.toLowerCase() === config.targetCategory.toLowerCase();
  } catch (err) {
    console.error(`[${channel}] Twitch API fetch error:`, err.message);
    return false; // fail-safe
  }
}

module.exports = { getAppAccessToken, isLiveAndCategory };
