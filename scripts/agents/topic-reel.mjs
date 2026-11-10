// REEL DE TEMA (técnica / dato histórico): guion YA verificado en config/evergreen.json (con fuentes), sin IA.
// Voz → escenas ancladas a las palabras clave (cada elemento sale cuando la voz lo dice) → render → cola → Telegram.
//   Uso: node scripts/agents/topic-reel.mjs --topic=efecto-suelo [--no-voice]
import fs from 'node:fs';
import {speakAny, wordTimings, voiceEngines} from './lib/voice.mjs';
import {timeSentences} from './lib/director.mjs';
import {cleanDeep} from '../lib/text.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Convierte un tema en storyboard (escenas con tiempos en segundos) a partir de los tiempos por palabra. */
export function buildScenes(T, words, total) {
  const find = (kw, from) => { const k = norm(kw); for (let i = from; i < words.length; i++) if (norm(words[i].t).startsWith(k)) return i; throw new Error(`palabra clave «${kw}» no aparece en el guion de ${T.id}`); };
  const sents = timeSentences(T.script, words);
  const srcFrom = +Math.max(sents[sents.length - 2].start - 0.05, 0).toFixed(2);
  const scenes = [{type: 'hook', from: 0, to: 0}];
  let cur = 0, prev = 3.2;
  T.body.forEach((b, k) => {
    const i = find(b.kw, cur); cur = i + 1;
    const from = +Math.max(prev, words[i].start - 0.15).toFixed(2);
    const base = {from, to: 0};
    const at = (kw) => +Math.max(0.3, words[find(kw, i)].start - from - 0.05).toFixed(2);
    if (b.type === 'dato') scenes.push({type: 'dato', ...base, value: b.value, label: b.label, rows: b.rows ?? []});
    else if (b.type === 'list') scenes.push({type: 'list', ...base, title: b.title, rows: b.rows.map((r) => ({icon: r.icon, title: r.title, ...(r.sub ? {sub: r.sub} : {}), at: at(r.kw)}))});
    else if (b.type === 'tecnico') scenes.push({type: 'tecnico', ...base, title: b.title, parts: b.parts.map((p) => ({n: p.n, name: p.name, sub: p.sub, at: at(p.kw)}))});
    prev = from;
  });
  scenes[0].to = scenes[1].from;
  for (let k = 1; k < scenes.length; k++) scenes[k].to = k + 1 < scenes.length ? scenes[k + 1].from : srcFrom;
  scenes.push({type: 'sources', from: srcFrom, to: total});
  const problems = [];
  scenes.forEach((s, k) => { if (s.to - s.from < 1.8) problems.push(`escena ${k + 1} (${s.type}) muy corta: ${(s.to - s.from).toFixed(1)} s`); });
  return {scenes, problems};
}

if (process.argv[1]?.endsWith('topic-reel.mjs')) {
  const id = arg('topic');
  const T = JSON.parse(fs.readFileSync('config/evergreen.json', 'utf8')).find((t) => t.id === id);
  if (!T) { console.error(`Tema desconocido: ${id}`); process.exit(1); }
  const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
  const noVoice = process.argv.includes('--no-voice') || voiceEngines().length === 0;
  fs.mkdirSync('public/audio', {recursive: true});
  const qid = `t-${T.id}`.slice(0, 60);
  const v = noVoice ? null : await speakAny(T.script, qid);
  const seconds = v?.seconds ?? +(T.script.split(/\s+/).filter(Boolean).length / 2.6).toFixed(2);
  const words = v?.words ?? wordTimings(T.script, seconds);
  const total = +(seconds + 0.8).toFixed(2);
  const {scenes, problems} = buildScenes(T, words, total);
  const props = cleanDeep({kind: T.pillar === 'tecnica' ? 'tecnico' : 'dato', headline: T.headline, hl: T.hl, section: T.pillar === 'tecnica' ? 'Técnica' : 'Historia', chip: T.chip, date: T.date,
    sources: T.sources.map(({name, domain, official}) => ({name, domain, official: !!official})), scenes, words, ...(v ? {narration: {file: v.file, seconds: +v.seconds.toFixed(2)}} : {})});
  const names = T.sources.map((x) => x.name), listed = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
  // cuerpo = guion sin las dos últimas frases (fuentes y «Síguenos»), que van aparte
  const body = T.script.split(/(?<=[.!?])\s+/).filter((x) => !/^Esto lo cuentan|^Síguenos/i.test(x)).join(' ');
  const caption = `${T.headline}\n\n${body}\n\nFuentes: ${listed}.\n\nLa voz de este vídeo está generada con IA.\n\nSíguenos para más.\n\n${settings.hashtags} ${T.hashtags}`.trim();
  const note = [`GUION: ${T.script}`, `Enlaces de las fuentes (para comprobar): ${T.sources.map((x) => `${x.name}: ${x.url}`).join(' | ')}`, `Voz: ${v?.engine ?? 'sin voz'} · ${total.toFixed(0)} s · ${scenes.length} escenas`, ...problems.map((p) => 'Control de calidad: ' + p)].join('\n');
  const {enqueue} = await import('../lib/queue.mjs'); // solo aquí: necesita Remotion
  await enqueue({id: qid, composition: 'Reel', series: T.pillar === 'tecnica' ? 'tecnica' : 'datos', props, caption, sources: T.sources, note});
  console.log(`✓ en cola [${T.pillar}]: ${T.headline}`);
}
