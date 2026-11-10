// Utilidades mínimas de Telegram (sin dependencias).
import fs from 'node:fs';
const cfg = process.env.TELEGRAM_TOKEN ? {token: process.env.TELEGRAM_TOKEN, chat: process.env.TELEGRAM_CHAT}
  : fs.existsSync('.telegram.json') ? JSON.parse(fs.readFileSync('.telegram.json', 'utf8')) : null;
export const configured = () => !!cfg;
export const CHAT = String(cfg?.chat ?? '');
export async function call(method, body, form) {
  const r = await (await fetch(`https://api.telegram.org/bot${cfg.token}/${method}`, form
    ? {method: 'POST', body: form}
    : {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body ?? {})})).json();
  if (!r.ok) throw new Error(`${method}: ${r.description}`);
  return r.result;
}
export const say = (text, extra = {}) => call('sendMessage', {chat_id: CHAT, text: text.slice(0, 4000), disable_web_page_preview: true, ...extra});
export const KEYBOARD = (id) => ({inline_keyboard: [
  [{text: '✅ Me gusta', callback_data: `ok:${id}`}, {text: '🗑 Descartar', callback_data: `drop:${id}`}],
  [{text: '🔁 Otra noticia', callback_data: 'more'}],
]});
export async function sendVideo(file, caption, id) {
  const f = new FormData();
  f.append('chat_id', CHAT);
  f.append('caption', caption.slice(0, 1000));
  if (id) f.append('reply_markup', JSON.stringify(KEYBOARD(id))); // sin id (p. ej. presentación) no lleva botones
  f.append('video', new Blob([fs.readFileSync(file)], {type: 'video/mp4'}), 'reel.mp4');
  const m = await call('sendVideo', null, f);
  return {msgId: m.message_id, fileId: m.video?.file_id};
}
