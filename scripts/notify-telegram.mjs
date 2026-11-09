// Envía al móvil (Telegram, gratis) los reels pendientes: vídeo con botones + texto para pegar en Instagram.
//   Preparar (una vez):  node scripts/notify-telegram.mjs setup <TOKEN_DEL_BOT>
//   Uso diario:          node scripts/notify-telegram.mjs
import fs from 'node:fs';
import {listItems, saveItem, videoPath} from './lib/queue.mjs';
import {configured, say, sendVideo} from './bot/tg.mjs';
import {load, save} from './bot/state.mjs';

if (process.argv[2] === 'setup') {
  const token = process.argv[3];
  if (!token) { console.error('Uso: node scripts/notify-telegram.mjs setup <TOKEN>'); process.exit(1); }
  const r = await (await fetch(`https://api.telegram.org/bot${token}/getUpdates`)).json();
  const chat = r.result?.map((u) => u.message?.chat?.id).find(Boolean);
  if (!r.ok || !chat) { console.error('No veo ningún mensaje. Abre tu bot en Telegram, pulsa Start, escríbele "hola" y repite este comando.'); process.exit(1); }
  fs.writeFileSync('.telegram.json', JSON.stringify({token, chat}));
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({chat_id: chat, text: '✅ Conectado. Aquí recibirás los reels de F1 para aprobar.'})});
  console.log(`✓ Listo. Tu TELEGRAM_CHAT es: ${chat}  (y tu TELEGRAM_TOKEN el que acabas de usar). Guárdalos como secretos en GitHub.`);
  process.exit(0);
}

if (!configured()) { console.log('Telegram sin configurar (omito el aviso).'); process.exit(0); }
const pending = listItems().filter((i) => i.status === 'pending' && !i.notified && fs.existsSync(videoPath(i.id)));
if (!pending.length) { console.log('Nada nuevo que avisar.'); process.exit(0); }

const state = load();
await say(`📰 ${pending.length} reel(s) de F1 para revisar.\n• ✅ si te gusta (guárdalo y publícalo)\n• Para corregir: responde al vídeo con  «titular: …»  o  «guion: …»\n• 🔁 para pedir otra noticia`);
for (const it of pending) {
  try {
    const {msgId, fileId} = await sendVideo(videoPath(it.id), `${(it.series ?? '').toUpperCase()} · ${it.props?.headline ?? it.id}`, it.id);
    const script = (it.note ?? '').split('\n').find((l) => l.startsWith('GUION: '))?.slice(7) ?? '';
    state.items[it.id] = {id: it.id, composition: it.composition, props: it.props, caption: it.caption, script, series: it.series, msgId, fileId, status: 'sent', sentAt: new Date().toISOString()};
    const warn = (it.note ?? '').split('\n').filter((l) => l && !l.startsWith('GUION')).join('\n');
    await say(`${it.caption}${warn ? '\n\n⚠️ Notas:\n' + warn : ''}`);
    saveItem({...it, notified: true});
    save(state);
    console.log('✓ enviado', it.id);
  } catch (e) { console.error('✗', it.id, e.message); }
}
