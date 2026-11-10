// REEL RESUMEN (del día o de la semana): junta 2-4 noticias YA contrastadas (oficial o 2+ fuentes) en un solo vídeo.
// Cada noticia se cuenta con su detalle (sin nombrar los medios); los medios salen en pantalla al final. Sin rumores. No repite las que ya tuvieron reel.
//   Uso: node scripts/agents/summary-reel.mjs --mode=day|week
const TARGET_S = 60; // todos los vídeos duran un minuto
import fs from 'node:fs';
import {speakAny, wordTimings, voiceEngines} from './lib/voice.mjs';
import {timeSentences, rowFrom, iconFor} from './lib/director.mjs';
import {askLocal, ollamaAvailable, TRANSLATE} from './lib/llm.mjs';
import {isSpanish} from './lib/verify.mjs';
import {cleanText, cleanDeep} from '../lib/text.mjs';
import {load, save} from '../bot/state.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const ORD = ['Primera', 'Segunda', 'Tercera', 'Cuarta'];
const names = (c) => c.sources.map((s) => s.name);
const join = (a) => (a.length <= 1 ? a[0] ?? '' : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`);
const strip = (t) => t.replace(/[.!?…\s]+$/, '');

/** Elige hasta 4 noticias contrastadas de la ventana (24 h o 7 días) que aún no tuvieron reel propio (pueden repetirse en otro resumen). Pura: no toca la red. */
export function pickItems(state, mode, now = Date.now()) {
  const win = (mode === 'week' ? 7 : 1) * 86400e3;
  const used = new Set(state.made ?? []); // un resumen NO gasta las noticias: el del día coge siempre las mejores de la ventana
  return Object.entries(state.log ?? {})
    .map(([id, e]) => ({id, ...e}))
    .filter((e) => e.level !== 'RADAR' && !used.has(e.id) && now - new Date(e.t) < win && e.sources?.length)
    .sort((a, b) => (b.sources.length - a.sources.length) || (new Date(b.t) - new Date(a.t)))
    .slice(0, 4);
}

/** Guion + storyboard a partir de las noticias (titulares ya en español). */
export function buildSummary(items, mode, words, total) {
  // el guion lo calcula quien llama; aquí solo se anclan las escenas a las palabras
  const find = (kw, from) => { const k = norm(kw); for (let i = from; i < words.length; i++) if (norm(words[i].t).startsWith(k)) return i; throw new Error(`«${kw}» no está en el guion`); };
  const sents = timeSentences(items.script, words);
  const srcFrom = +Math.max(sents[sents.length - 2].start - 0.05, 0).toFixed(2);
  const i0 = find(ORD[0], 0);
  const from = +Math.max(3.2, words[i0].start - 0.15).toFixed(2);
  const rows = items.list.map((it, k) => ({icon: iconFor(it.headline), ...rowFrom(it.headline), sub: it.level === 'OFICIAL' ? 'Fuente oficial' : `${it.sources.length} fuentes`, at: +Math.max(0.3, words[find(ORD[k], i0)].start - from - 0.05).toFixed(2)}));
  return [{type: 'hook', from: 0, to: from}, {type: 'list', from, to: srcFrom, title: mode === 'week' ? 'Lo de la semana' : 'Lo de hoy', rows}, {type: 'sources', from: srcFrom, to: total}];
}

export function scriptFor(list, mode) {
  const intro = mode === 'week' ? 'Resumen de la semana en la F1: lo más importante.' : 'Resumen de la F1: esto es lo que ha pasado hoy.';
  // se cuenta la noticia (titular + detalle del propio medio); los nombres de los medios NO se dicen: salen en pantalla al final
  const body = list.map((it, k) => `${ORD[k]} noticia: ${strip(it.headline)}.${it.detail ? ` ${strip(it.detail)}.` : ''}`);
  return [intro, ...body, 'Todas están confirmadas por varios medios, y ahora te los enseño.', 'Síguenos para más.'].join(' ');
}

if (process.argv[1]?.endsWith('summary-reel.mjs')) {
  const mode = arg('mode') === 'week' ? 'week' : 'day';
  const {configured, say} = await import('../bot/tg.mjs');
  const state = load();
  const useLLM = await ollamaAvailable();
  const toEs = async (text) => {
    if (isSpanish(text)) return text;
    if (!useLLM) return null;
    const digits = (t) => (t.match(/\d+(?:[.,]\d+)?/g) ?? []).join('|');
    try { const t = (await askLocal(TRANSLATE, text, {temperature: 0})).replace(/^["“]|["”]$/g, '').trim(); return isSpanish(t) && digits(t) === digits(text) ? t : null; } catch { return null; }
  };
  const list = [];
  for (const e of pickItems(state, mode)) { const h = await toEs(cleanText(e.headline)); if (!h) continue; const d = e.detail ? await toEs(cleanText(e.detail)) : null; list.push({...e, headline: h, detail: d ?? ''}); }
  if (list.length < 2) {
    if (configured()) await say(`📭 No hay suficientes noticias contrastadas para un resumen ${mode === 'week' ? 'de la semana' : 'de hoy'} (necesito 2 o más que no hayan tenido ya su reel).`);
    console.log('Sin material para el resumen.'); process.exit(0);
  }
  const script = scriptFor(list, mode);
  const noVoice = voiceEngines().length === 0;
  const qid = `resumen-${mode}-${new Date().toISOString().slice(0, 10)}`;
  fs.mkdirSync('public/audio', {recursive: true});
  const v = noVoice ? null : await speakAny(script, qid);
  const seconds = v?.seconds ?? +(script.split(/\s+/).length / 2.6).toFixed(2);
  const words = v?.words ?? wordTimings(script, seconds);
  const total = +Math.max(TARGET_S, seconds + 0.8).toFixed(2);
  const scenes = buildSummary({script, list}, mode, words, total);
  const srcs = [...new Map(list.flatMap((it) => it.sources).map((s) => [s.name, s])).values()].slice(0, 4);
  const props = cleanDeep({kind: 'noticia', headline: mode === 'week' ? 'Resumen de la semana en la F1' : 'Resumen del día en la F1', hl: 'Resumen', section: mode === 'week' ? 'Resumen semanal' : 'Resumen del día', chip: `${list.length} noticias`,
    date: new Date().toLocaleDateString('es-ES', {day: '2-digit', month: 'short'}).toUpperCase(), sources: srcs.map(({name, domain, official}) => ({name, domain, official: !!official})), scenes, words,
    ...(v ? {narration: {file: v.file, seconds: +v.seconds.toFixed(2)}} : {})});
  const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
  const nm = [...new Set(list.flatMap((it) => it.sources.map((x) => x.name)))].slice(0, 6);
  const caption = `${props.headline}\n\n${list.map((it, k) => `${k + 1}. ${strip(it.headline)} (${it.sources.map((x) => x.name).slice(0, 3).join(', ')})`).join('\n')}\n\nFuentes: ${nm.length > 1 ? `${nm.slice(0, -1).join(', ')} y ${nm.at(-1)}` : nm[0]}.\n\nLa voz de este vídeo está generada con IA.\n\nSíguenos para no perderte nada.\n\n${settings.hashtags} #ResumenF1`.trim();
  const links = list.map((it, k) => `${k + 1}. ${it.sources.map((x) => `${x.name}: ${x.url}`).join(' | ')}`).join('\n');
  const {enqueue} = await import('../lib/queue.mjs');
  await enqueue({id: qid, composition: 'Reel', series: 'resumen', props, caption, sources: srcs, note: `GUION: ${script}\nEnlaces (para comprobar):\n${links}\nVoz: ${v?.engine ?? 'sin voz'} · ${total.toFixed(0)} s · ${list.length} noticias`});
  const s2 = load(); s2.summarized = [...new Set([...(s2.summarized ?? []), ...list.map((x) => x.id)])].slice(-300); save(s2);
  console.log(`✓ resumen en cola con ${list.length} noticias`);
}
