// «HOY TOCA»: un mensaje al día en Telegram (hacia las 19:00 de Madrid) que dice qué subir hoy y te da los botones.
//   Prioridad: 1) noticia importante (te llega aparte, como 🚨)  2) resumen si hay material  3) apartado del día (técnica / historia).
//   Uso: node scripts/hoytoca.mjs [--force]      (--force: ignora la hora y el «ya enviado hoy»)
import fs from 'node:fs';
import {configured, call, CHAT} from './bot/tg.mjs';
import {load, save} from './bot/state.mjs';
import {pickItems} from './agents/summary-reel.mjs';

export const PILLAR_BY_DOW = {1: 'semana', 2: 'tecnica', 3: 'dato', 4: 'tecnica', 5: 'dato', 6: 'dato', 0: 'tecnica'}; // 0 = domingo
const NAME = {tecnica: '🧪 Técnica', dato: '📚 Historia / dato', semana: '📰 Resumen de la semana'};
const ICON = {tecnica: '🧪', dato: '📚'};

/** Lógica pura (testeable): qué ofrecer hoy. */
export function plan({state, topics, dow, now = Date.now()}) {
  let pillar = PILLAR_BY_DOW[dow];
  const week = pickItems(state, 'week', now), day = pickItems(state, 'day', now);
  const wantWeek = pillar === 'semana' && week.length >= 2;
  if (pillar === 'semana') pillar = 'tecnica'; // el lunes sin material suficiente para resumen, toca técnica
  const used = new Set(state.topicsMade ?? []);
  let pool = topics.filter((t) => t.pillar === pillar && !used.has(t.id));
  const repeated = !pool.length;
  if (repeated) pool = topics.filter((t) => t.pillar === pillar);
  return {pillar, topics: pool.slice(0, 3), repeated, day: day.length, week: week.length, wantWeek};
}

if (process.argv[1]?.endsWith('hoytoca.mjs')) {
  if (!configured()) { console.log('Telegram sin configurar.'); process.exit(0); }
  const force = process.argv.includes('--force');
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date())
    .reduce((o, p) => (p.type !== 'literal' ? {...o, [p.type]: p.value} : o), {});
  const hour = +parts.hour % 24, today = `${parts.year}-${parts.month}-${parts.day}`;
  const dow = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6}[parts.weekday];
  const state = load();
  if (!force && (hour < 19 || hour > 21 || state.hoyDate === today)) { console.log(`Ahora no toca (${hour}h, último envío: ${state.hoyDate ?? 'nunca'}).`); process.exit(0); }
  const topics = JSON.parse(fs.readFileSync('config/evergreen.json', 'utf8'));
  const p = plan({state, topics, dow});
  const lines = [`🎯 HOY TOCA: ${p.wantWeek ? NAME.semana : NAME[p.pillar]}`, ''];
  if (p.day >= 2) lines.push(`📌 Hoy hay ${p.day} noticias contrastadas sin reel: puedes juntarlas en un resumen.`);
  if (p.wantWeek) lines.push(`📌 Esta semana hay ${p.week} noticias para el resumen semanal.`);
  lines.push(p.topics.length ? `Elige un tema${p.repeated ? ' (ya has usado todos; te los repito)' : ''}:` : 'No tengo temas de este apartado ahora mismo.');
  const kb = [];
  if (p.wantWeek) kb.push([{text: '📰 Resumen de la semana', callback_data: 'sum:week'}]);
  for (const t of p.topics) kb.push([{text: `${ICON[t.pillar]} ${t.headline}`.slice(0, 60), callback_data: `topic:${t.id}`}]);
  if (p.day >= 2) kb.push([{text: `📰 Resumen de hoy (${p.day} noticias)`, callback_data: 'sum:day'}]);
  kb.push([{text: '📋 Menú de noticias', callback_data: 'more'}, {text: '😴 Hoy nada', callback_data: 'skip'}]);
  await call('sendMessage', {chat_id: CHAT, text: lines.join('\n'), reply_markup: {inline_keyboard: kb}});
  state.hoyDate = today; save(state);
  console.log('✓ «hoy toca» enviado');
}
