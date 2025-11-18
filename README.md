# LurkBaitBot – Twitch Fishing Bot

**⚠️ Disclaimer:**  
This bot is for **educational purposes only**. Do **not** use it on Twitch streams without the explicit permission of the streamer. Misuse may result in account bans or other consequences. Use responsibly.

LurkBaitBot is a Twitch bot designed to automate `!fish` commands, track fishing pulls, log stats, provide daily/all-time summaries, send Discord alerts, and Excel logging. Supports multiple streamers, trigger mentions, random cooldowns, and category checks.

---

## Features

* Automatically sends `!fish` when streamer is live or after trigger mention
* Detects trigger mentions from specific users and starts cooldown timers
* Fixed or randomized cooldowns between messages
* Tracks daily and all-time statistics per streamer
* Logs pulls to `logs/pulls-<streamer>.txt` with timestamps
* Excel logging per streamer with optional formatting for rarity, high-gold, and heaviest fish
* Sends daily summaries via Discord webhook at bot start and at 23:59
* Supports multiple Twitch channels
* High-gold and heaviest fish alerts in console and Discord

---

## Dependencies

Install required packages:

```npm install tmi.js exceljs node-cron node-fetch```

⦁	tmi.js – Twitch chat interaction

⦁	exceljs – Excel logging

⦁	node-cron – Scheduled daily summaries

⦁	node-fetch – Twitch API calls

## Configuration

The bot uses a config.json file for settings.

⦁	Bot username and OAuth token

⦁	Channels to monitor

⦁	Twitch API credentials (Client ID & Client Secret)

⦁	Message to send (!fish)

⦁	Cooldown settings (fixed or randomized)

⦁	Category check options

⦁	Minimum gold for alerts

⦁	Trigger users and mention string

⦁	High-gold alert threshold

⦁	Discord webhook URL for summaries and alerts

## Usage

Start the bot:
```node bot.js```

⦁	First !fish is sent automatically if streamer is live

⦁	Trigger mentions start cooldowns

⦁	Pulls are logged and stats updated

⦁	Daily summary sent via Discord on startup and at 23:59

# Optional scripts:

⦁	webhook.js → Trigger daily summary manually without starting full bot

⦁	excelLogger.js → Handles Excel logging per streamer

## Logs & Data

⦁	logs/pulls-<streamer>.txt → Chat pull logs with timestamps

⦁	data/<streamer>.json → Daily and all-time stats per streamer

⦁	excel/<streamer>.xlsx → Excel logging (per streamer)

## License

* MIT License – see LICENSE file

## Repository

* GitHub: https://github.com/Kjerne/LurkBaitBot
