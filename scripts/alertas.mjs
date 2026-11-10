// ALERTAS DE ÚLTIMA HORA: se ejecuta cada pocos minutos (workflow alertas.yml). Mira los medios, y si hay una
// noticia NUEVA y contrastada (oficial o 2+ fuentes) te avisa en Telegram con un botón «Hacer reel».
// No publica nada ni gasta voz/render: solo avisa. Tú decides con un toque.
//   Uso: node scripts/alertas.mjs   (después de news fetch + cluster)
import fs from 'node:fs';
import {configured, call, CHAT} from './bot/tg.mjs';
import {load, save} from './bot/state.mjs';
import {routeCluster} from './lib/classify.mjs';
import {cleanText, tokens, similar} from './lib/text.mjs';

if (!configured()) { console.log('Telegram sin configurar.'); process.exit(0); }
const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
const A = {fromHour: 8, toHour: 23, maxPerDay: 6, maxPerRun: 2, freshHours: 4, ...settings.alerts};
const clusters = JSON.parse(fs.readFileSync('data/news/clusters.json', 'utf8'));
const seen = new Set(fs.existsSync('data/news/seen.json') ? JSON.parse(fs.readFileSync('data/news/seen.json', 'utf8')) : []);
const state = load();
state.alerted ??= {}; state.offered ??= {}; state.menuClusters ??= {}; state.made ??= [];

// Registro de noticias contrastadas de los últimos 8 días (lo usan los resúmenes del día y de la semana).
state.log ??= {};
/** 1-2 frases del texto del propio medio (oficial primero) para que el resumen cuente la noticia y no solo el titular. */
const detailOf = (c) => {
  const cand = [...c.sources].sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0) || (b.summary ?? '').length - (a.summary ?? '').length);
  for (const s of cand) {
    const t = (s.summary ?? '').replace(/\s+/g, ' ').trim();
    if (t.length < 60) continue;
    const parts = t.split(/(?<=[.!?])\s+/); let out = '';
    for (const p of parts) { if ((out + ' ' + p).trim().length > 190) break; out = (out + ' ' + p).trim(); }
    if (out.length >= 50 && !/[…]|\.\.\.$/.test(out) && !out.toLowerCase().startsWith(c.headline.toLowerCase().slice(0, 30))) return out;
  }
  return '';
};
for (const c of clusters) {
  if (c.level === 'RADAR') continue;
  state.log[c.id] = {headline: c.headline, level: c.level, t: c.latest, detail: detailOf(c), sources: c.sources.map((s) => ({name: s.name, domain: s.domain, url: s.url ?? s.link, official: !!s.official}))};
}
for (const [id, e] of Object.entries(state.log)) if (Date.now() - new Date(e.t) > 8 * 86400e3) delete state.log[id];
save(state);

const madrid = (d = new Date()) => new Intl.DateTimeFormat('es-ES', {timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(d)
  .reduce((o, p) => (p.type !== 'literal' ? {...o, [p.type]: p.value} : o), {});
const nowM = madrid();
const hour = +nowM.hour % 24, today = `${nowM.year}-${nowM.month}-${nowM.day}`;
if (hour < A.fromHour || hour >= A.toHour) { console.log(`Fuera de horario de avisos (${hour}h).`); process.exit(0); }

for (const [id, a] of Object.entries(state.alerted)) if (Date.now() - new Date(a.t) > 3 * 86400e3) delete state.alerted[id];
const sentToday = Object.values(state.alerted).filter((a) => { const m = madrid(new Date(a.t)); return `${m.year}-${m.month}-${m.day}` === today; }).length;
let budget = Math.min(A.maxPerRun, A.maxPerDay - sentToday);
if (budget <= 0) { console.log('Límite de avisos de hoy alcanzado.'); process.exit(0); }

const alertedList = Object.values(state.alerted).map((a) => ({tok: tokens(a.headline), t: a.t, names: new Set(a.names ?? [])}));
// ¿Es la misma historia ya avisada? Si vuelve a salir con medios NUEVOS (p. ej. la BBC matiza lo que dijo otro) y han pasado 2 h,
// se avisa de nuevo como ACTUALIZACIÓN, porque una noticia puede cambiar en el día.
const namesOf = (c) => [...c.sources, ...c.alsoSay].map((s) => s.name);
const kindOf = (c) => {
  const prev = alertedList.filter((a) => similar(tokens(c.headline), a.tok, settings.similarity));
  if (!prev.length) return 'new';
  const known = new Set(prev.flatMap((a) => [...a.names]));
  const old = Math.min(...prev.map((a) => Date.now() - new Date(a.t)));
  return namesOf(c).some((n) => !known.has(n)) && old > 2 * 3600e3 ? 'update' : 'dup';
};
const isLead = (c) => [...c.sources, ...c.alsoSay].some((s) => s.manual);
const fresh = clusters
  .filter((c) => c.level !== 'RADAR' && !seen.has(c.id) && !state.alerted[c.id] && !state.offered[c.id] && !state.made.includes(c.id))
  .filter((c) => Date.now() - new Date(c.latest) < A.freshHours * 3600e3)
  .map((c) => ({c, kind: kindOf(c)})).filter((x) => x.kind !== 'dup');

const label = (c) => {
  const mercado = routeCluster(c).series === 'mercado' ? ' · MERCADO' : '';
  return (c.level === 'OFICIAL' ? '🏛 Fuente oficial' : `🔎 ${c.count} fuentes`) + mercado;
};
let n = 0;
for (const {c, kind} of fresh) {
  if (n >= budget) break;
  const names = c.sources.map((s) => s.name).join(', ');
  await call('sendMessage', {chat_id: CHAT, disable_web_page_preview: true,
    text: `${kind === 'update' ? '🔄 ACTUALIZACIÓN (la historia ha cambiado)' : '🚨 NOTICIA NUEVA'}\n${label(c)}${isLead(c) ? ' · 📌 tu pista' : ''}\n\n${cleanText(c.headline)}${c.headlineLang === 'en' ? ' (EN)' : ''}\n\nFuentes: ${names}`,
    reply_markup: {inline_keyboard: [[{text: '🎬 Hacer reel', callback_data: `pick:${c.id}`}, {text: '🙈 Ignorar', callback_data: 'skip'}]]}});
  state.alerted[c.id] = {t: new Date().toISOString(), headline: c.headline, names: namesOf(c)};
  state.offered[c.id] = new Date().toISOString(); state.menuClusters[c.id] = c; // pick:… la encuentra aquí
  n++;
}
save(state);
console.log(`✓ ${n} aviso(s) enviados (${fresh.length} candidata(s) nuevas, ${sentToday} avisos ya hoy).`);
