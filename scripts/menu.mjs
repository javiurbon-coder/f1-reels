// MENÚ DEL DÍA: en vez de generar un vídeo a ciegas, manda a Telegram las mejores noticias/rumores
// recientes con un botón cada una. Tú eliges y solo entonces se hace ese reel (sin gastar voz ni render de más).
//   Uso: node scripts/menu.mjs   (después de news:fetch y news:cluster)
import fs from 'node:fs';
import {configured, call, CHAT} from './bot/tg.mjs';
import {load, save} from './bot/state.mjs';
import {routeCluster} from './lib/classify.mjs';
import {cleanText} from './lib/text.mjs';

if (!configured()) { console.log('Telegram sin configurar.'); process.exit(0); }
const clusters = JSON.parse(fs.readFileSync('data/news/clusters.json', 'utf8'));
const seen = new Set(fs.existsSync('data/news/seen.json') ? JSON.parse(fs.readFileSync('data/news/seen.json', 'utf8')) : []);
const state = load();
state.offered ??= {}; state.menuClusters ??= {}; state.made ??= [];

// olvida lo ofrecido hace más de 3 días (para no repetir menús, pero tampoco ocultar noticias para siempre)
const now = Date.now();
for (const [id, t] of Object.entries(state.offered)) if (now - new Date(t) > 3 * 86400e3) { delete state.offered[id]; delete state.menuClusters[id]; }

const fresh = clusters.filter((c) => !seen.has(c.id) && !state.offered[c.id] && !state.made.includes(c.id));
const isLead = (c) => [...c.sources, ...c.alsoSay].some((s) => s.manual);
const leads = fresh.filter(isLead).slice(0, 2);
const confirmed = fresh.filter((c) => !isLead(c)).filter((c) => c.level !== 'RADAR').slice(0, 4);
const rumors = fresh.filter((c) => c.level === 'RADAR').slice(0, 1);
const options = [...leads, ...confirmed, ...rumors].filter((c, i, a) => a.indexOf(c) === i).slice(0, 5);

if (!options.length) {
  await call('sendMessage', {chat_id: CHAT, text: '📭 Hoy no hay noticias nuevas que merezcan reel. Si quieres, pulsa 🔁 más tarde.', reply_markup: {inline_keyboard: [[{text: '🔁 Buscar otra vez', callback_data: 'more'}]]}});
  save(state); process.exit(0);
}

const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
const label = (c) => {
  const kind = routeCluster(c).series;
  if (c.level === 'RADAR') return isLead(c) ? '📌 TU PISTA · rumor sin confirmar' : '⚠️ RUMOR sin confirmar';
  const tag = (isLead(c) ? '📌 TU PISTA · ' : '') + (kind === 'mercado' ? 'MERCADO · ' : '');
  return c.level === 'OFICIAL' ? `🏛 ${tag}Fuente oficial` : `🔎 ${tag}${c.count} fuentes`;
};
const lines = options.map((c, i) => `${NUM[i]} ${label(c)}\n${cleanText(c.headline)}${c.headlineLang === 'en' ? ' (EN)' : ''}`);
const keyboard = [
  ...options.map((c, i) => [{text: `${NUM[i]} ${cleanText(c.headline).slice(0, 48)}`, callback_data: `pick:${c.id}`}]),
  [{text: '🔁 Otras opciones', callback_data: 'more'}, {text: '😴 Hoy nada', callback_data: 'skip'}],
];
await call('sendMessage', {chat_id: CHAT, text: `📰 MENÚ DE HOY — elige qué reel hago:\n\n${lines.join('\n\n')}`.slice(0, 4000), disable_web_page_preview: true, reply_markup: {inline_keyboard: keyboard}});
for (const c of options) { state.offered[c.id] = new Date().toISOString(); state.menuClusters[c.id] = c; }
save(state);
console.log(`✓ menú enviado con ${options.length} opción(es)`);
