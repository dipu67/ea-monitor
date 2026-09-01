# EA Monitor

Personal Telegram bot that watches X/Twitter accounts for new posts and flags crypto alpha signals (contract addresses, mint dates, listings, pump.fun / dexscreener links).

## Install (Linux, macOS, Termux)

Termux first: `pkg update && pkg install curl`

```bash
curl -fsSL https://raw.githubusercontent.com/dipu67/ea-monitor/main/install.sh | bash
```

Then start:

```bash
ea-monitor
# or
cd ~/ea-monitor && npm start
```

On first run the terminal asks for `TELEGRAM_BOT_TOKEN` ([@BotFather](https://t.me/BotFather)) and `ALLOWED_ID` ([@userinfobot](https://t.me/userinfobot)), then writes them to `.env`.

Install location is `$HOME/ea-monitor` (override with `EA_MONITOR_HOME`).

## Manual setup

```bash
git clone https://github.com/dipu67/ea-monitor.git
cd ea-monitor
npm install
npm run build
npm start
```

Projects, settings, and subscribers are stored in `data/store.json`.

## Commands

| Command | What it does |
| --- | --- |
| `/start` | Register this chat for alerts (allowed users only) |
| `/add username` | Watch an X account (skips existing tweets) |
| `/remove username` | Stop watching |
| `/list` | Show watched accounts |
| `/check` | Poll immediately |
| `/settings` | Status, pause/resume, interval, replies |

Tweets are polled on a loop (default 5 minutes). Only `ALLOWED_ID` can use the bot; alerts go to those user ids.
