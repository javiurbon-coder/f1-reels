// Orquestador: investigación (ya hecha por npm run news:collect) → guion → verificación → voz → render → COLA DE REVISIÓN.
// Nunca publica. Uso: node scripts/agents/make-reels.mjs [--no-voice] [--template]
import fs from 'node:fs';
import {enqueue} from '../lib/queue.mjs';
import {askLocal, ollamaAvailable, SYSTEM, templateScript} from './lib/llm.mjs';
import {checkScript} from './lib/verify.mjs';
import {routeCluster, propsFor, topicsOf, loadTopics} from '../lib/classify.mjs';
import {piperAvailable, speak, wordTimings} from './lib/voice.mjs';

const args = new Set(process.argv.slice(2));
// --tema=alonso,ferrari  → solo noticias de esos pilotos/equipos (por defecto: general)
const temaArg = process.argv.find((a) => a.startsWith('--tema='))?.slice(7);
const only = temaArg ? temaArg.split(',').map((t) => t.trim().toLowerCase()) : null;
const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
const clusters = JSON.parse(fs.readFileSync('data/news/clusters.json', 'utf8'));
const seenFile = 'data/news/seen.json';
const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, 'utf8')) : []);
const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', {day: '2-digit', month: 'short'}).toUpperCase();

const NO_CONF = /no (est[aá] |ha sido |est[aá]n )?confirmad|sin confirmar|sin confirmaci[oó]n|rumor/i;
const useLLM = !args.has('--template') && (await ollamaAvailable());
const useVoice = !args.has('--no-voice') && piperAvailable();
console.log(`Guionista: ${useLLM ? 'Ollama local' : 'plantilla (sin IA)'} · Locutor: ${useVoice ? 'Piper local' : 'sin voz'}`);
fs.mkdirSync('public/audio', {recursive: true});

const priority = settings.priorityTopics ?? [];
for (const c of clusters) c.topics = topicsOf(c);
if (only) console.log(`Tema(s): ${only.join(', ')}`);
// los temas prioritarios (settings.priorityTopics) van primero; el resto conserva su orden
clusters.sort((a, b) => priority.some((t) => b.topics.includes(t)) - priority.some((t) => a.topics.includes(t)));

const jobs = [];
let made = 0, rumors = 0;
for (const c of clusters) {
  if (only && !c.topics.some((t) => only.includes(t))) continue;
  if (made >= (+process.env.MAX_PER_RUN || settings.maxPerRun)) break;
  if (seen.has(c.id)) continue;
  const route = routeCluster(c);
  if (route.series === 'rumor' && (!settings.rumors?.enabled || rumors >= (settings.rumors?.maxPerRun ?? 1))) continue;
  const titles = [...c.sources, ...c.alsoSay].map((s) => s.title);

  // --- agente traductor: titular en inglés → español (solo con Ollama; se verifica igual que el guion) ---
  if (useLLM && c.headlineLang === 'en') {
    try {
      const t = (await askLocal('Traduce este titular de Fórmula 1 al español de España. Mantén nombres propios y cifras exactamente. Devuelve solo el titular traducido, sin comillas ni explicaciones.', c.headline)).replace(/^["“]|["”]$/g, '');
      if (checkScript(t, [c.headline], {minWords: 3, maxWords: 25}).ok) { c.originalHeadline = c.headline; c.headline = t; c.headlineLang = 'es'; }
    } catch {}
  }

  // --- agente guionista + verificador (hasta 3 intentos, luego plantilla) ---
  let script = null, notes = [];
  if (useLLM) {
    for (let i = 0; i < 3 && !script; i++) {
      try {
        const txt = await askLocal(SYSTEM, `Nivel: ${c.level}${c.level === 'RADAR' ? ' (RUMOR: NO está confirmado, dilo claramente)' : ''}. Medios: ${c.sources.map((s) => s.name).join(', ')}.\nTitulares:\n- ${titles.join('\n- ')}`);
        const v = checkScript(txt, titles);
        if (c.level === 'RADAR' && !NO_CONF.test(txt)) v.problems.push('un rumor debe decir que NO está confirmado');
        if (v.ok && !(c.level === 'RADAR' && !NO_CONF.test(txt))) script = txt; else notes.push(`Intento ${i + 1} descartado: ${v.problems.join('; ')}`);
      } catch (e) { notes.push('LLM: ' + e.message); break; }
    }
  }
  if (!script) { script = templateScript(c); notes.push('Guion de plantilla (sin IA).'); }

  // --- agente locutor ---
  const props = propsFor(route, c, fmtDate);
  if (useVoice) {
    const sec = speak(script, `public/audio/${c.id}.wav`);
    props.narration = {file: `audio/${c.id}.wav`, seconds: +sec.toFixed(2), words: wordTimings(script, sec)};
  }

  const tags = c.topics.map((t) => loadTopics()[t].hashtags).join(' ');
  const caption = (route.series === 'rumor' ? `⚠️ RUMOR NO CONFIRMADO: ${c.headline}\n\nLo cuentan:\n` : `${c.headline}\n\nContrastado por ${c.count} ${c.count === 1 ? 'fuente' : 'fuentes'}:\n`) +
    [...c.sources, ...(route.series === 'rumor' ? c.alsoSay : [])].map((s) => `• ${s.name}: ${s.url}`).join('\n') +
    (route.series !== 'rumor' && c.alsoSay.length ? `\n\nTambién lo comentan: ${c.alsoSay.map((s) => s.name).join(', ')}` : '') + `\n\n${settings.hashtags} ${tags}`.trimEnd();
  jobs.push({c, route, props, caption, script, notes});
  made++; if (route.series === 'rumor') rumors++;
}

// Fase 2: render. Va DESPUÉS de generar todos los audios, porque Remotion copia la carpeta public/ al empaquetar.
made = 0;
for (const {c, route, props, caption, script, notes} of jobs) {
  try {
    await enqueue({id: c.id, composition: route.composition, props, caption, sources: c.sources,
      note: ['GUION: ' + script, c.topics.length ? 'Temas: ' + c.topics.map((t) => loadTopics()[t].name).join(', ') : '', ...notes, c.originalHeadline ? `Titular traducido por IA local (original: ${c.originalHeadline}). Revísalo.` : '', c.headlineLang === 'en' ? 'Titular en inglés: reescríbelo antes de aprobar.' : ''].filter(Boolean).join('\n')});
    seen.add(c.id); made++;
    console.log(`✓ en cola [${route.series}]: [${c.level}] ${c.headline}`);
  } catch (e) { console.error('✗', c.id, e.message); }
}
fs.writeFileSync(seenFile, JSON.stringify([...seen], null, 2));
console.log(`OK → ${made} reel(s) pendientes de revisión (npm run review).`);
