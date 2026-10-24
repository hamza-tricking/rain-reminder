require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getRainRisk } = require('./forecast');
const { sendMessage, answerCallback, getUpdates } = require('./telegram');

const env = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  lat: Number(process.env.LAT || 35.56),
  lon: Number(process.env.LON || 6.17),
  timezone: process.env.TIMEZONE || 'Africa/Algiers',
  threshold: Number(process.env.RAIN_THRESHOLD || 60),
  hoursAhead: Number(process.env.HOURS_AHEAD || 3),
  checkEveryMin: Number(process.env.CHECK_EVERY_MIN || 30),
  resendEverySec: Number(process.env.RESEND_EVERY_SEC || 30),
  maxAttempts: Number(process.env.MAX_ATTEMPTS || 480),
  cooldownHours: Number(process.env.COOLDOWN_HOURS || 1),
  location: process.env.LOCATION_NAME || 'باتنة',
};

const STATE_FILE = path.join(__dirname, '..', 'state.json');

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function loadState() {
  const defaults = { offset: 0, armed: true, clearSince: null };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return defaults;
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const ACK_WORDS = ['تم', 'done', 'ok', 'ok!', 'شفت'];

function isAck(update) {
  if (update.callback_query) {
    return update.callback_query.data === 'ack';
  }
  const text = (update.message?.text || '').trim().toLowerCase();
  return ACK_WORDS.includes(text);
}

// Handles one Telegram update. Returns true if it acknowledged the alert.
async function handleUpdate(state, update) {
  const chatId = String(update.callback_query?.message?.chat.id ?? update.message?.chat.id ?? '');

  if (update.callback_query) {
    await answerCallback(env.token, update.callback_query.id).catch(() => {});
  }

  if (!env.chatId) {
    if (update.message?.text === '/start' && chatId) {
      await sendMessage(env.token, chatId, `مرحباً! رقم المحادثة هو: ${chatId}\nضعه في ملف .env داخل TELEGRAM_CHAT_ID ثم أعد تشغيل البرنامج.`);
    }
    return false;
  }

  if (chatId !== env.chatId) return false;
  return isAck(update);
}

// Polls Telegram until the timeout passes. Returns true if an ack arrived.
async function waitForAck(state, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const wait = Math.min(25, Math.max(1, Math.floor((deadline - Date.now()) / 1000)));
    const { updates, next } = await getUpdates(env.token, state.offset, wait);
    state.offset = next;
    saveState(state);

    for (const update of updates) {
      if (await handleUpdate(state, update)) return true;
    }
  }
  return false;
}

async function runAlert(state, risk) {
  const hour = risk.peakTime.slice(11, 16);
  const text =
    `🌧 تنبيه مطر في ${env.location}!\n` +
    `احتمال المطر ${risk.peakProbability}% حوالي الساعة ${hour}.\n` +
    `خذ مظلتك واحتط! اضغط الزر عند الاستلام.`;

  for (let attempt = 1; attempt <= env.maxAttempts; attempt++) {
    log(`alert attempt ${attempt}`);
    await sendMessage(env.token, env.chatId, text, true);
    if (await waitForAck(state, env.resendEverySec)) {
      log('alert acknowledged');
      await sendMessage(env.token, env.chatId, '✅ تم استلام التنبيه.');
      state.armed = false;
      saveState(state);
      return;
    }
  }

  log('alert max attempts reached without ack');
  await sendMessage(env.token, env.chatId, '⚠️ انتهت محاولات التنبيه بدون تأكيد.');
  state.armed = false;
  saveState(state);
}

async function checkForecast(state) {
  const risk = await getRainRisk({
    lat: env.lat,
    lon: env.lon,
    timezone: env.timezone,
    hoursAhead: env.hoursAhead,
    threshold: env.threshold,
  });
  log(`forecast peak ${risk.peakProbability}% at ${risk.peakTime}`);

  if (!risk.risky) {
    // Forecast is clear: start the quiet period, then re-arm after it.
    if (state.clearSince === null) state.clearSince = Date.now();
    if (!state.armed && Date.now() - state.clearSince >= env.cooldownHours * 3600 * 1000) {
      state.armed = true;
      log('alert re-armed after quiet period');
    }
    saveState(state);
    return;
  }

  // Rain is forecast again, so any new quiet period starts over.
  state.clearSince = null;
  saveState(state);
  if (state.armed) {
    await runAlert(state, risk);
  }
}

async function main() {
  if (!env.token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing in .env');
  }

  const state = loadState();
  log(`rain-reminder started for ${env.location}`);

  while (true) {
    try {
      await checkForecast(state);
    } catch (err) {
      log('check failed:', err.message);
    }
    // Keep polling Telegram during the idle time so /start and acks are handled.
    await waitForAck(state, env.checkEveryMin * 60).catch((err) => log('poll failed:', err.message));
  }
}

main().catch((err) => {
  log('fatal:', err.message);
  process.exit(1);
});
