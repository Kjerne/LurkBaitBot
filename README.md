# 🎣 LurkBaitBot – Twitch Fishing Bot
## 🤖 AI Assistance Disclaimer

Some portions of the code in this repository were generated or assisted by AI tools, such as ChatGPT.

## ⚠️ Important Notes:

* The code may contain bugs or security issues — always review and test thoroughly before use.
* You are responsible for proper usage and compliance with Twitch Terms of Service.
* No sensitive credentials (OAuth tokens, passwords, API keys) are included in this repository.

This repository is intended for learning, experimentation, and educational purposes.

## 🐟 Overview

LurkBaitBot is a Twitch bot designed to automate !fish commands, track fishing pulls, log stats, provide daily/all-time summaries, send Discord alerts only for summaries, and Excel logging. It supports multiple streamers, trigger mentions, random cooldowns, category checks, and more.

## ✨ Features

* 🎯 Automatically sends !fish when a streamer is live or after a trigger mention.
* 👀 Detects trigger mentions from specific users and starts cooldown timers.
* ⏱️ Fixed or randomized cooldowns between messages.
* 📊 Tracks daily and all-time statistics per streamer.
* 📝 Logs pulls to logs/pulls-<streamer>.txt with timestamps.
* 📈 Excel logging per streamer with optional formatting for rarity, high-gold, and heaviest fish.
* 📨 Sends daily and all-time summaries via Discord webhook at bot start and at 23:59.
* 🌐 Supports multiple Twitch channels.
* 💰 High-gold and heaviest fish alerts in console and Discord summaries.
* 🛡️ Live caching and polling to reduce Twitch API requests.
* ⏳ Watchdog system ensures messages are sent if they fail or timeout.

## 🛠️ Dependencies

Install required packages:
```npm install tmi.js exceljs node-cron node-fetch```
* 💬 tmi.js – Twitch chat interaction
* 📊 exceljs – Excel logging
* 📅 node-cron – Scheduled daily summaries
* 🌐 node-fetch – Twitch API calls

## ⚙️ Configuration

The bot uses a config.json file for settings.
* 🧑‍💻 Bot username and OAuth token
* 📺 Channels to monitor
* 🔑 Twitch API credentials (Client ID & Client Secret)
* ✉️ Message to send (!fish)
* ⏱️ Cooldown settings (fixed or randomized)
* 🎯 Category check options
* 💰 Minimum gold for alerts
* 👤 Trigger users and mention string
* 🚨 High-gold alert threshold
* 📨 Discord webhook URL (only used for daily/all-time summaries)
* ⏳ Live cache duration and polling interval
* ⏱️ Watchdog enable/disable and extra headspace time

## 🚀 Usage

Start the bot:
```node bot.js```
* 🏁 First !fish is sent automatically if streamer is live.
* 👀 Trigger mentions start cooldowns and queue messages (no Discord webhook for individual messages).
* 📝 Pulls are logged and stats updated.
* 🗓️ Daily and all-time summaries sent via Discord on startup and at 23:59.

#🧩 Optional Scripts
* ⚡ webhook.js → Trigger daily summary manually without starting full bot.
* 📊 excelLogger.js → Handles Excel logging per streamer.

## 🗂️ Logs & Data
* 📝 logs/pulls-<streamer>.txt → Chat pull logs with timestamps.
* 📊 data/.json → Daily and all-time stats per streamer.
* 📈 excel/.xlsx → Excel logging (per streamer).

## 📝 License
* MIT License – see LICENSE file

## 🌐 Repository
* GitHub: https://github.com/Kjerne/LurkBaitBot
