# rain-reminder

Checks the rain forecast for Batna (Algeria) every 30 minutes. If the chance of rain
in the next 3 hours reaches the threshold, it sends a Telegram alert every 30 seconds
until you press the button "تم، شفت التنبيه" (or send `تم` / `done`).

## Setup (once)
1. In Telegram, open @BotFather, send `/newbot`, and copy the token.
2. Put the token in `.env` on the server (`TELEGRAM_BOT_TOKEN`).
3. Send `/start` to your bot. It replies with your chat id.
4. Put that id in `TELEGRAM_CHAT_ID` in `.env`, then run `pm2 restart rain-reminder --update-env`.

## Run
- Local: `npm install` then `npm start`
- Server: `pm2 logs rain-reminder`

## Settings
See `.env.example`. Main ones: `RAIN_THRESHOLD` (percent), `HOURS_AHEAD`, `COOLDOWN_HOURS`,
`MAX_ATTEMPTS` (how many alerts before it gives up without confirmation).
