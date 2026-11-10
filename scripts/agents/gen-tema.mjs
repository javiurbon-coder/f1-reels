// TEMA AUTOMÁTICO (gratis): busca el artículo en Wikipedia, lo resume con la IA local (Ollama) usando SOLO ese texto,
// comprueba que cada cifra y cada nombre del guion salgan del texto, y monta el vídeo. Si algo no cuadra, NO hay borrador.
//   Uso: node scripts/agents/gen-tema.mjs --seed=drs [--suffix=1110] [--no-voice]
import fs from 'node:fs';
import {askLocal, ollamaAvailable, llmName} from './lib/llm.mjs';
import {produce} from './lib/produce.mjs';
import {voiceNote} from './lib/voice.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const seed = JSON.parse(fs.readFileSync('config/temas-auto.json', 'utf8')).find((s) => s.id === arg('seed'));
if (!seed) { console.error('Tema desconocido: ' + arg('seed')); process.exit(1); }
if (!(await ollamaAvailable())) { console.error('Sin IA local disponible: no se genera.'); process.exit(1); }
const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
const W = 'https://es.wikipedia.org/w/api.php';
const wj = async (qs) => (await fetch(`${W}?format=json&origin=*&${qs}`, {headers: {'user-agent': 'contrastado-f1/1.0'}})).json();

const hit = (await wj(`action=query&list=search&srlimit=1&srsearch=${encodeURIComponent(seed.q)}`)).query?.search?.[0];
if (!hit) { console.error('No encuentro artículo.'); process.exit(1); }
const page = Object.values((await wj(`action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(hit.title)}`)).query.pages)[0];
const src = (page.extract ?? '').replace(/\n{2,}/g, '\n').slice(0, 7000);
if (src.length < 800) { console.error('Artículo demasiado corto.'); process.exit(1); }
const url = `https://es.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`;
console.log(`Fuente: ${hit.title} (${src.length} caracteres) · IA: ${llmName()}`);

const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nsrc = norm(src).replace(/(\d)[.\s](?=\d{3}\b)/g, '$1');
const SYSTEM = `Eres el guionista de una cuenta de Fórmula 1 en español de España. Escribe la locución de un reel de UN MINUTO: entre 150 y 165 palabras.
REGLAS: usa SOLO hechos del TEXTO que te doy; no inventes ni añadas nada de tu conocimiento. Frases cortas (máximo 22 palabras, una idea por frase). Empieza con una pregunta o una frase potente. Cifras y nombres tal cual aparecen en el texto. Sin emojis, sin hashtags, sin listas, sin mencionar "Wikipedia" ni "el texto". Responde SOLO con la locución, en un único párrafo.`;

/** Cada número y cada nombre propio del guion tiene que estar en el texto fuente. */
function verify(s) {
  const n = s.split(/\s+/).length, problems = [];
  if (n < 135 || n > 175) problems.push(`longitud ${n} palabras`);
  for (const d of s.match(/\d[\d.,]*/g) ?? []) if (!nsrc.includes(norm(d).replace(/[.,]$/, '').replace(/(\d)[.\s](?=\d{3}\b)/g, '$1'))) problems.push(`cifra ${d} no está en la fuente`);
  const sents = s.split(/(?<=[.!?¡¿])\s+/);
  for (const se of sents) se.split(/\s+/).slice(1).forEach((w) => {
    const c = w.replace(/^[¿¡("«]+|[.,;:!?)"»]+$/g, '');
    if (/^\p{Lu}\p{L}{3,}$/u.test(c) && !nsrc.includes(norm(c))) problems.push(`nombre ${c} no está en la fuente`);
  });
  return problems;
}
let body = '', last = [];
for (const t of [0.2, 0.35, 0.5]) {
  const s = (await askLocal(SYSTEM, `TEXTO:\n${src}`, {temperature: t})).replace(/\s+/g, ' ').trim();
  last = verify(s);
  console.log(`intento t=${t}: ${last.length ? last.join('; ') : 'OK'}`);
  if (!last.length) { body = s; break; }
}
if (!body) { console.error('El guion no pasó la verificación: no se crea borrador.'); process.exit(1); }

const script = `${body} Los datos salen de Wikipedia, que te enseño ahora. Síguenos para más.`;
const qid = `a-${seed.id}${arg('suffix') ? '-' + arg('suffix') : ''}`.slice(0, 60);
fs.mkdirSync('public/audio', {recursive: true});
const prod = await produce({id: qid, script, noVoice: process.argv.includes('--no-voice')});
const section = seed.pillar === 'tecnica' ? 'Técnica' : 'Historia';
const sources = [{name: 'Wikipedia', domain: 'es.wikipedia.org', official: false}];
const props = {kind: 'dato', headline: seed.headline, hl: seed.hl, section, chip: section, date: 'EXPLICADO', sources, scenes: prod.scenes, words: prod.words, ...(prod.narration ? {narration: prod.narration} : {})};
const caption = `${seed.headline}\n\n${body}\n\nFuente: Wikipedia.\n\nLa voz de este vídeo está generada con IA.\n\nSíguenos para más.\n\n${settings.hashtags} ${seed.hashtags}`.trim();
const note = [`GUION: ${script}`, `Enlace de la fuente (para comprobar): Wikipedia: ${url}`, 'Tema generado por IA local a partir de un solo artículo: REVISA los datos antes de publicar.', `${voiceNote(prod.engine)} · ${prod.total.toFixed(0)} s · ${prod.scenes.length} escenas`, ...prod.problems.map((p) => 'Control de calidad: ' + p)].join('\n');
const {enqueue} = await import('../lib/queue.mjs');
await enqueue({id: qid, composition: 'Reel', series: seed.pillar === 'tecnica' ? 'tecnica' : 'datos', props, caption, sources: [{name: 'Wikipedia', url, title: hit.title}], note});
console.log(`✓ en cola [${seed.pillar}]: ${seed.headline}`);
