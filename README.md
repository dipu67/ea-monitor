# EA Monitor

Personal Telegram bot that watches X/Twitter accounts for new posts and flags crypto alpha signals (contract addresses, mint dates, listings, pump.fun / dexscreener links).

## Setup

1. Copy `.env.example` to `.env` and set `TELEGRAM_BOT_TOKEN` (from [@BotFather](https://t.me/BotFather)) and `ALLOWED_ID` (your numeric Telegram user id, from [@userinfobot](https://t.me/userinfobot)). If either is missing, `npm start` asks for it in the terminal and writes it to `.env`.
2. Install and create the SQLite database:

```bash
npm install
npx prisma generate
npx prisma db push
```

3. Run:

```bash
npm start
```

4. Open the bot in Telegram, send `/start`, then `/add username`.

## Commands

| Command | What it does |
| --- | --- |
| `/start` | Register this chat for alerts (allowed users only) |
| `/add username` | Watch an X account (skips existing tweets) |
| `/remove username` | Stop watching |
| `/list` | Show watched accounts |
| `/check` | Poll immediately |
| `/settings` | Status, pause/resume, interval, replies |

Tweets are polled on a loop (default 60s). Only `ALLOWED_ID` can use the bot; alerts go to those user ids.
