// Lee lo que has pulsado/escrito en Telegram, actualiza el estado y avisa si hay trabajo pesado (rehacer vídeos).
import fs from 'node:fs';
import {call, say, configured, CHAT} from './tg.mjs';
import {load, save} from './state.mjs';
import {handleUpdate} from './handle.mjs';

const out = (k, v) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
if (!configured()) { console.log('Telegram sin configurar.'); out('work', 'false'); process.exit(0); }
const state = load();
const updates = await call('getUpdates', {offset: state.offset, timeout: 0, allowed_updates: ['message', 'callback_query']});
for (const u of updates) {
  state.offset = u.update_id + 1;
  const r = handleUpdate(state, u, CHAT);
  try {
    if (u.callback_query) await call('answerCallbackQuery', {callback_query_id: u.callback_query.id, text: r.answer ?? ''});
    if (r.clear) await call('editMessageReplyMarkup', {chat_id: CHAT, message_id: r.clear, reply_markup: {inline_keyboard: []}});
    for (const t of r.reply) await say(t);
  } catch (e) { console.error(e.message); }
}
save(state);
const work = state.more > 0 || Object.values(state.items).some((i) => i.status === 'edit');
console.log(`${updates.length} novedad(es). Trabajo pesado: ${work}`);
out('work', String(work));
