const fetch = require("node-fetch");
const config = require("./config.json");

let accessToken = null;

async function getAppAccessToken() {
  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${config.clientId}&client_secret=${config.clientSecret}&grant_type=client_credentials`, { method:"POST" });
  const data = await res.json();
  accessToken = data.access_token;
}

async function isLiveAndCategory(channel) {
  if (!accessToken) await getAppAccessToken();
  const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channel}`, {
    headers: { "Client-ID": config.clientId, "Authorization": `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (!data.data || data.data.length===0) return false;
  const stream = data.data[0];
  if (!config.checkCategory) return true;
  return stream.game_name.toLowerCase() === config.targetCategory.toLowerCase();
}

module.exports = { getAppAccessToken, isLiveAndCategory };
