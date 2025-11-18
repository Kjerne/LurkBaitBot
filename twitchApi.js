const fetch = require("node-fetch");
const config = require("./config.json");
const { logWithTime, logError } = require("./logger");

let accessToken = null;
let rateLimitRemaining = 800; // default

// Queue API requests to avoid throttling
const apiQueue = [];
let apiProcessing = false;

async function processApiQueue() {
  if (apiProcessing || apiQueue.length === 0) return;
  apiProcessing = true;

  while (apiQueue.length > 0) {
    const { channel, resolve, reject } = apiQueue.shift();
    try {
      const live = await _isLive(channel);
      resolve(live);
    } catch (err) {
      reject(err);
    }
  }

  apiProcessing = false;
}

async function _isLive(channel, retryToken = true, retries = 3, backoff = 1000) {
  if (!accessToken) await getAppAccessToken();

  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channel}`, {
      headers: {
        "Client-ID": config.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.headers.has("ratelimit-remaining")) {
      rateLimitRemaining = parseInt(res.headers.get("ratelimit-remaining"), 10);
    }

    if (res.status === 401 && retryToken) {
      logWithTime(`[${channel}] Token expired, refreshing...`);
      await getAppAccessToken();
      return _isLive(channel, false, retries, backoff);
    }

    if (!res.ok) {
      logError(`[${channel}] Twitch API error: ${res.status} ${res.statusText}`);
      return false;
    }

    const data = await res.json();
    if (!data.data || data.data.length === 0) return false;

    // Category check (supports string or array)
    if (!config.checkCategory) return true;

    const categories = Array.isArray(config.targetCategory)
      ? config.targetCategory
      : [config.targetCategory];

    return categories.some(cat =>
      data.data[0].game_name.toLowerCase().includes(cat.toLowerCase())
    );
  } catch (err) {
    if (retries > 0) {
      logWithTime(`[${channel}] Network error, retrying in ${backoff}ms (${retries} retries left): ${err.message}`);
      await new Promise(r => setTimeout(r, backoff));
      return _isLive(channel, retryToken, retries - 1, backoff * 2);
    } else {
      logError(`[${channel}] Twitch API failed after retries: ${err.message}`);
      return false;
    }
  }
}

// Public wrapper to queue API calls safely
function isLiveAndCategory(channel) {
  return new Promise((resolve, reject) => {
    apiQueue.push({ channel, resolve, reject });
    processApiQueue();
  });
}

async function getAppAccessToken() {
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${config.clientId}&client_secret=${config.clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error(`Failed to fetch token: ${res.status} ${res.statusText}`);
    const data = await res.json();
    accessToken = data.access_token;
    logWithTime(`[Twitch API] Access token obtained`);
    return accessToken;
  } catch (err) {
    logError(`[Twitch API] Failed to get access token: ${err.message}`);
    throw err;
  }
}

// Validate OAuth token at startup
async function validateOAuthToken(oauthToken) {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: `OAuth ${oauthToken.replace(/^oauth:/, "")}` }
    });

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    return { valid: true, login: data.login, clientId: data.client_id, scopes: data.scopes };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = { getAppAccessToken, isLiveAndCategory, rateLimitRemaining, validateOAuthToken };
