#!/bin/bash
set -e

APP_NAME=rain-reminder
REPO_URL=https://github.com/hamza-tricking/rain-reminder.git
APP_DIR=/root/$APP_NAME

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

npm ci --omit=dev

if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
fi

if ! grep -q '^TELEGRAM_BOT_TOKEN=.\+' .env; then
  echo "TELEGRAM_BOT_TOKEN is empty in $APP_DIR/.env."
  echo "Fill it, then run this script again."
  exit 0
fi

if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start src/index.js --name "$APP_NAME" --cwd "$APP_DIR"
fi

pm2 save
pm2 startup systemd -u root --hp /root || true
pm2 status "$APP_NAME"
