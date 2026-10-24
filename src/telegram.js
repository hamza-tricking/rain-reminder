async function callApi(token, method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

function sendMessage(token, chatId, text, withAckButton = false) {
  return callApi(token, 'sendMessage', {
    chat_id: chatId,
    text,
    ...(withAckButton && {
      reply_markup: { inline_keyboard: [[{ text: '✅ تم، شفت التنبيه', callback_data: 'ack' }]] },
    }),
  });
}

function answerCallback(token, callbackId) {
  return callApi(token, 'answerCallbackQuery', { callback_query_id: callbackId });
}

// Long-polls Telegram for new updates. Returns the list and the next offset.
async function getUpdates(token, offset, timeoutSec) {
  const updates = await callApi(token, 'getUpdates', {
    offset,
    timeout: timeoutSec,
    allowed_updates: ['message', 'callback_query'],
  });
  const next = updates.length ? updates[updates.length - 1].update_id + 1 : offset;
  return { updates, next };
}

module.exports = { sendMessage, answerCallback, getUpdates };
