// Orquestador: investigación (ya hecha por npm run news:collect) → guion → verificación → voz → render → COLA DE REVISIÓN.
// Nunca publica. Uso: node scripts/agents/make-reels.mjs [--no-voice] [--template]
import fs from 'node:fs';
import {enqueue} from '../lib/queue.mjs';
import {askLocal, ollamaAvailable, llmName, SYSTEM, TRANSLATE, templateScript, sourcesLine} from './lib/llm.mjs';
import {checkScript, isSpanish} from './lib/verify.mjs';
import {routeCluster, propsFor, topicsOf, loadTopics} from '../lib/classify.mjs';
import {voiceEngines, voiceNote} from './lib/voice.mjs';
import {produce} from './lib/produce.mjs';
import {analyze} from './lib/insights.mjs';
import {cleanText, cleanDeep} from '../lib/text.mjs';

const args = new Set(process.argv.slice(2));
// --tema=alonso,ferrari  → solo noticias de esos pilotos/equipos (por defecto: general)
const temaArg = process.argv.find((a) => a.startsWith('--tema='))?.slice(7);
const idArg = process.argv.find((a) => a.startsWith('--id='))?.slice(5); // reel elegido en el menú
const only = temaArg ? temaArg.split(',').map((t) => t.trim().toLowerCase()) : null;
const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
const clusters = JSON.parse(fs.readFileSync('data/news/clusters.json', 'utf8'));
const seenFile = 'data/news/seen.json';
const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, 'utf8')) : []);
const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', {day: '2-digit', month: 'short'}).toUpperCase();

const NO_CONF = /no (est[aá] |ha sido |est[aá]n )?confirmad|sin confirmar|sin confirmaci[oó]n|rumor/i;
const useLLM = !args.has('--template') && (await ollamaAvailable());
const noVoice = args.has('--no-voice') || voiceEngines().length === 0;
console.log(`Guionista: ${useLLM ? llmName() : 'plantilla (sin IA)'} · Locutor: ${noVoice ? 'sin voz' : voiceEngines().join(' > ')} · Datos: Jolpica`);
fs.mkdirSync('public/audio', {recursive: true});

const nz = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
// si el guion ya empieza con el titular, no se repite al principio del pie de foto
const nlead = (h, sc) => (nz(sc).startsWith(nz(h).slice(0, 25)) ? '' : `${h}\n\n`);
const priority = settings.priorityTopics ?? [];
for (const c of clusters) {
  c.headline = cleanText(c.headline);
  for (const s of [...c.sources, ...c.alsoSay]) { s.title = cleanText(s.title); if (s.summary) s.summary = cleanText(s.summary); }
  c.topics = topicsOf(c);
}
if (only) console.log(`Tema(s): ${only.join(', ')}`);
// los temas prioritarios (settings.priorityTopics) van primero; el resto conserva su orden
clusters.sort((a, b) => priority.some((t) => b.topics.includes(t)) - priority.some((t) => a.topics.includes(t)));

const TEAM_COLOR = {ferrari: '#e8002d', mclaren: '#ff8000', redbull: '#3671c6', mercedes: '#27f4d2', aston: '#2fb38a', alpine: '#ff87bc', williams: '#64c4ff', haas: '#b6babd', audi: '#c8c8c8', cadillac: '#9aa0a6'};
const jobs = [];
let made = 0, rumors = 0;
for (const c of clusters) {
  if (idArg && c.id !== idArg) continue;
  if (only && !c.topics.some((t) => only.includes(t))) continue;
  if (made >= (+process.env.MAX_PER_RUN || settings.maxPerRun)) break;
  if (!idArg && seen.has(c.id)) continue;
  const route = routeCluster(c);
  if (!idArg && route.series === 'rumor' && (!settings.rumors?.enabled || rumors >= (settings.rumors?.maxPerRun ?? 1))) continue;
  const pool = [...c.sources, ...c.alsoSay].slice(0, 5);
  const digits = (t) => (t.match(/\d+(?:[.,]\d+)?/g) ?? []).join('|');
  let notes = [];

  // --- agente traductor: titular y resúmenes en inglés → español (se comprueba idioma y cifras) ---
  const toEs = async (text) => {
    const t = (await askLocal(TRANSLATE, text, {temperature: 0})).replace(/^["“]|["”]$/g, '').trim();
    return isSpanish(t) && digits(t) === digits(text) ? t : null;
  };
  const material = []; // textos YA en español: es lo único que lee el guionista
  if (useLLM) {
    if (c.headlineLang === 'en') {
      try { const t = await toEs(c.headline); if (t) { c.originalHeadline = c.headline; c.headline = t; c.headlineLang = 'es'; } } catch {}
    }
    for (const s of pool.slice(0, 3)) {
      try {
        const title = s.lang === 'es' || isSpanish(s.title) ? s.title : await toEs(s.title);
        const summary = !s.summary ? '' : s.lang === 'es' || isSpanish(s.summary) ? s.summary : await toEs(s.summary.slice(0, 450));
        if (title) material.push(`${s.name}: ${title}.${summary ? ' ' + summary : ''}`);
      } catch {}
    }
  } else for (const s of pool) if (isSpanish(s.title)) material.push(`${s.name}: ${s.title}.${s.summary && isSpanish(s.summary) ? ' ' + s.summary : ''}`);
  if (!isSpanish(c.headline)) { console.log(`⏭ saltada (titular en inglés y sin traducción): ${c.headline}`); continue; }
  if (!material.length) material.push(c.headline + '.');

  // --- agente analista: datos REALES (Jolpica) sobre el piloto de la noticia, con cifras calculadas ---
  let facts = [];
  // Un reel = un tema: los datos de carrera solo entran si la noticia trata del rendimiento en pista.
  const ON_TRACK = /\b(gana|ganó|victoria|vence|podio|remonta|carrera|gran premio|gp|clasificaci[oó]n|pole|parrilla|adelant|campeonato|puntos|l[ií]der)\b/i;
  if (route.series === 'noticias' && ON_TRACK.test(c.headline)) {
    const dt = c.topics.map((t) => ({t, ...loadTopics()[t]})).find((x) => x.driverId);
    if (dt) {
      try { facts = (await analyze({driverId: dt.driverId, driverName: dt.name.split(' ').pop()})).slice(0, 5); } catch (e) { notes.push('Datos no disponibles: ' + e.message); }
      if (facts.length) console.log(`  · datos de ${dt.name}: ${facts.map((f) => f.id).join(', ')}`);
    }
  }

  // --- agente guionista + verificador (hasta 3 intentos, luego plantilla) ---
  const corpus = [c.headline, ...material, ...pool.flatMap((s) => [s.title, s.summary ?? '']), ...facts.map((f) => f.line)];
  const rich = material.join(' ').length > 400 || facts.length > 0;
  const dataBlock = facts.length ? `\nDATOS CALCULADOS (reales, de la API oficial; puedes usarlos tal cual):\n- ${facts.map((f) => f.line).join('\n- ')}` : '';
  let script = null;
  if (useLLM) {
    for (let i = 0; i < 3 && !script; i++) {
      try {
        const txt = await askLocal(SYSTEM, `Nivel: ${c.level}${c.level === 'RADAR' ? ' (RUMOR: NO está confirmado, dilo claramente)' : ''}. Medios: ${c.sources.map((s) => s.name).join(', ')}.\nTitular: ${c.headline}\nMaterial:\n- ${material.join('\n- ')}${dataBlock}`);
        const v = checkScript(txt, corpus, {minWords: 85, maxWords: 165});
        if (!isSpanish(txt)) v.problems.push('no está en español');
        if (c.level === 'RADAR' && !NO_CONF.test(txt)) v.problems.push('un rumor debe decir que NO está confirmado');
        if (v.problems.length === 0) script = txt; else notes.push(`Intento ${i + 1} descartado: ${v.problems.join('; ')}`);
      } catch (e) { notes.push('LLM: ' + e.message); break; }
    }
  }
  if (!script) { script = templateScript(c, [...material.slice(0, 3).map((m) => m.replace(/^[^:]+:\s*/, '')), ...facts.slice(0, 2).map((f) => f.line)]); notes.push('Guion de plantilla (sin IA).'); }

  // Rumores: se nombra quién los cuenta. Resto: solo se dice cuántos medios lo confirman (los nombres salen en pantalla al final)
  const named = [...c.sources, ...(c.alsoSay ?? [])].map((s) => s.name);
  const ok = c.level === 'RADAR' ? named.some((n) => script.toLowerCase().includes(n.toLowerCase())) : /(medios|fuente)/i.test(script);
  if (!ok) script = `${script.replace(/\s+$/, '')} ${sourcesLine(c)}`;

  // --- agentes locutor + director + control de calidad (diseño v2: una sola composición "Reel") ---
  const base = propsFor(route, c, fmtDate);
  const T = loadTopics();
  const drv = c.topics.map((t) => T[t]).find((x) => x.driverId), team = c.topics.map((t) => ({id: t, ...T[t]})).find((x) => TEAM_COLOR[x.id]);
  const year = c.headline.match(/\b20\d\d\b/)?.[0];
  const ctx = route.series === 'mercado' && drv && team && year ? {market: {kindLabel: base.kind ?? 'FICHAJE', driver: drv.name.split(' ').pop(), team: team.name, teamColor: TEAM_COLOR[team.id], until: year}}
    : route.series === 'rumor' ? {rumor: {who: base.sources.map((x) => x.name).slice(0, 3).join(' · '), n: base.sources.length}} : {};
  const prod = await produce({id: c.id, script, facts, noVoice, ctx});
  const hlWord = (c.headline.split(' ').find((w, i) => /^\p{Lu}/u.test(w) && w.length > 3 && (i > 0 || c.topics.length)) ?? '').replace(/[^\p{L}\d]/gu, '');
  const shortHl = (h) => (h.length <= 90 ? h : h.slice(0, 90).replace(/\s+\S*$/, '').replace(/[,;:¿¡\s]+$/, '') + '…');
  const props = cleanDeep({kind: route.series === 'noticias' ? 'noticia' : route.series, headline: shortHl(c.headline), hl: hlWord, date: base.date,
    section: ({rumor: 'Rumor', mercado: 'Fichajes', resultado: 'Resultado', noticias: 'Última hora'})[route.series] ?? undefined,
    chip: route.series === 'rumor' ? 'Rumor' : c.level === 'OFICIAL' ? 'Oficial' : `${base.sources.length} fuentes`,
    sources: base.sources.slice(0, 4), scenes: prod.scenes, words: prod.words, ...(prod.narration ? {narration: prod.narration} : {})});
  route.composition = 'Reel';
  if (prod.problems.length) notes.push('Control de calidad: ' + prod.problems.join('; '));
  notes.push(`${voiceNote(prod.engine)} · ${prod.total.toFixed(0)} s · ${prod.scenes.length} escenas (${prod.dataScenes} con datos)`);

  const tags = c.topics.map((t) => loadTopics()[t].hashtags).join(' ');
  const all = [...c.sources, ...(route.series === 'rumor' ? c.alsoSay : [])];
  const nm = all.map((s) => s.name), listed = nm.length > 1 ? `${nm.slice(0, -1).join(', ')} y ${nm.at(-1)}` : nm[0] ?? '';
  const caption = (route.series === 'rumor' ? `⚠️ RUMOR NO CONFIRMADO: ${nlead(c.headline, script)}${script}\n\nLo cuentan: ${listed}.` : `${nlead(c.headline, script)}${script}\n\nContrastado por ${c.count} ${c.count === 1 ? 'fuente' : 'fuentes'}: ${listed}.`) +
    (route.series !== 'rumor' && c.alsoSay.length ? `\nTambién lo comentan: ${c.alsoSay.map((s) => s.name).join(', ')}.` : '') +
    `\n\nLa voz de este vídeo está generada con IA.\n\n${settings.hashtags} ${tags}`.trimEnd();
  notes.push('Enlaces de las fuentes (para comprobar): ' + all.map((s) => `${s.name}: ${s.url}`).join(' | '));
  jobs.push({c, route, props, caption, script, notes});
  made++; if (route.series === 'rumor') rumors++;
}

// Fase 2: render. Va DESPUÉS de generar todos los audios, porque Remotion copia la carpeta public/ al empaquetar.
made = 0;
for (const {c, route, props, caption, script, notes} of jobs) {
  try {
    await enqueue({id: c.id, composition: route.composition, series: route.series, props, caption, sources: c.sources,
      note: ['GUION: ' + script, c.topics.length ? 'Temas: ' + c.topics.map((t) => loadTopics()[t].name).join(', ') : '', ...notes, c.originalHeadline ? `Titular traducido por IA local (original: ${c.originalHeadline}). Revísalo.` : '', c.headlineLang === 'en' ? 'Titular en inglés: reescríbelo antes de aprobar.' : ''].filter(Boolean).join('\n')});
    seen.add(c.id); made++;
    console.log(`✓ en cola [${route.series}]: [${c.level}] ${c.headline}`);
  } catch (e) { console.error('✗', c.id, e.message); }
}
fs.writeFileSync(seenFile, JSON.stringify([...seen], null, 2));
console.log(`OK → ${made} reel(s) pendientes de revisión (npm run review).`);
