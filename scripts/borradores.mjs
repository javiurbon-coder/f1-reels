// BORRADORES EN LA NUBE (workflow borradores.yml). Sin avisos al móvil.
//   --pick     elige qué noticias merecen vídeo hoy (máx. settings.drafts.maxPerDay) y escribe sus ids en $GITHUB_OUTPUT (ids=a,b)
//   --upload   sube lo montado (queue/<id>) a la release «borradores» de GitHub, de donde lo baja tu PC (npm run review), y limpia lo viejo
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {load, save} from './bot/state.mjs';
import {listItems, videoPath, posterPath} from './lib/queue.mjs';

const TAG = 'borradores';
const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
const D = {maxPerDay: 3, maxPerRun: 1, keepDays: 6, topicFromHour: 10, topicRepeatDays: 7, minMaterialChars: 450, autoRepeatDays: 45, summaryFromHour: 19, ...settings.drafts};
const state = load(); state.drafted ??= {};
const out = (k, v) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
const gh = (...a) => spawnSync('gh', a, {encoding: 'utf8'});

if (process.argv.includes('--pick')) {
  const clusters = JSON.parse(fs.readFileSync('data/news/clusters.json', 'utf8'));
  const seen = new Set(fs.existsSync('data/news/seen.json') ? JSON.parse(fs.readFileSync('data/news/seen.json', 'utf8')) : []);
  const day = (d) => new Date(d).toLocaleDateString('sv-SE', {timeZone: 'Europe/Madrid'});
  const today = day(Date.now());
  const done = Object.values(state.drafted).filter((t) => day(t) === today).length;
  const left = Math.min(D.maxPerRun, D.maxPerDay - done);
  const ids = left <= 0 ? [] : clusters
    .filter((c) => c.level !== 'RADAR' && !seen.has(c.id) && !state.drafted[c.id] && !(state.made ?? []).includes(c.id))
    .filter((c) => Date.now() - new Date(c.latest) < 24 * 3600e3)
    .filter((c) => [...c.sources, ...(c.alsoSay ?? [])].reduce((n, x) => n + (x.summary?.length ?? 0), 0) >= D.minMaterialChars) // sin texto suficiente no hay vídeo de un minuto: esa noticia queda para el resumen
    .sort((a, b) => ((b.level === 'OFICIAL') - (a.level === 'OFICIAL')) || b.count - a.count)
    .slice(0, left).map((c) => c.id);
  for (const id of ids) state.drafted[id] = new Date().toISOString();
  for (const [id, t] of Object.entries(state.drafted)) if (Date.now() - new Date(t) > 10 * 86400e3) delete state.drafted[id];
  // 1 tema (técnica / historia) al día, a partir de las 10h: el que lleve más tiempo sin prepararse (y no antes de 7 días)
  const hour = +new Intl.DateTimeFormat('es-ES', {timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false}).format(new Date()) % 24;
  state.draftedTopics ??= {};
  let topic = '';
  if (hour >= D.topicFromHour && !Object.values(state.draftedTopics).some((t) => day(t) === today)) {
    const ev = JSON.parse(fs.readFileSync('config/evergreen.json', 'utf8')).map((t) => ({key: 'ev:' + t.id, pillar: t.pillar === 'tecnica' ? 'tecnica' : 'historia', days: D.topicRepeatDays}));
    const au = JSON.parse(fs.readFileSync('config/temas-auto.json', 'utf8')).map((t) => ({key: 'au:' + t.id, pillar: t.pillar, days: D.autoRepeatDays}));
    const cand = [...ev, ...au].map((t) => ({...t, at: state.draftedTopics[t.key] ?? state.draftedTopics[t.key.slice(3)] ?? 0}))
      .filter((t) => !t.at || Date.now() - new Date(t.at) > t.days * 86400e3)
      .sort((x, y) => new Date(x.at || 0) - new Date(y.at || 0));
    // se alterna técnica / historia cuando se puede
    const pick = cand.find((t) => t.pillar !== state.lastPillar) ?? cand[0];
    if (pick) { topic = pick.key; state.draftedTopics[pick.key] = new Date().toISOString(); state.lastPillar = pick.pillar; }
  }
  // resumen del día: 1 al día, a partir de las 19h (si hay menos de 2 noticias, el propio script no hace nada)
  let summary = '';
  if (hour >= D.summaryFromHour && state.draftedSummary !== today) { summary = 'day'; state.draftedSummary = today; }
  save(state);
  console.log(`Borradores hoy: ${done}/${D.maxPerDay} · noticias: ${ids.join(', ') || 'ninguna'} · tema: ${topic || 'ninguno'} · resumen: ${summary || 'no'}`);
  out('ids', ids.join(',')); out('topic', topic); out('summary', summary);
  process.exit(0);
}

if (process.argv.includes('--upload')) {
  if (gh('release', 'view', TAG).status !== 0) gh('release', 'create', TAG, '--title', 'Borradores', '--notes', 'Vídeos preparados por el robot. Se borran solos a los pocos días.', '--prerelease');
  let n = 0;
  for (const it of listItems().filter((i) => i.status === 'pending' && !i.uploaded && fs.existsSync(videoPath(i.id)))) {
    const dir = path.dirname(videoPath(it.id));
    const files = [[path.join(dir, 'item.json'), `${it.id}.json`], [videoPath(it.id), `${it.id}.mp4`], [posterPath(it.id), `${it.id}.jpg`]];
    for (const ext of ['mp3', 'wav']) { const a = `public/audio/${it.id}.${ext}`; if (fs.existsSync(a)) files.push([a, `${it.id}.${ext}`]); }
    // se sube con el nombre final (gh usa el nombre del archivo), copiando a un directorio temporal
    const tmp = fs.mkdtempSync('borr-');
    const paths = files.filter(([f]) => fs.existsSync(f)).map(([f, name]) => { const p = path.join(tmp, name); fs.copyFileSync(f, p); return p; });
    // el JSON se sube el último: el PC solo baja borradores cuyo .json existe, es decir, completos
    paths.sort((a, b) => (a.endsWith('.json') ? 1 : 0) - (b.endsWith('.json') ? 1 : 0));
    let ok = true;
    for (const p of paths) { const r = gh('release', 'upload', TAG, p, '--clobber'); if (r.status !== 0) { console.error(r.stderr); ok = false; break; } }
    fs.rmSync(tmp, {recursive: true, force: true});
    if (ok) { n++; console.log('✓ borrador subido', it.id); }
  }
  // limpieza: fuera lo de más de keepDays días
  const v = gh('release', 'view', TAG, '--json', 'assets');
  if (v.status === 0) for (const a of JSON.parse(v.stdout).assets) if (Date.now() - new Date(a.createdAt) > D.keepDays * 86400e3) gh('release', 'delete-asset', TAG, a.name, '--yes');
  console.log(`OK → ${n} borrador(es) subidos.`);
}
