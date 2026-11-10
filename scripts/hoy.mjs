// FLUJO DIARIO DESDE EL PC:  npm run hoy
// 1) trae noticias y las cruza  2) te enseña las mejores  3) eliges número (o "t" = tema, "r" = resumen)
// 4) se monta el vídeo con voz  5) se abre el panel de revisión para verlo antes de publicar.
import fs from 'node:fs';
import readline from 'node:readline/promises';
import {spawnSync, spawn} from 'node:child_process';
import {routeCluster} from './lib/classify.mjs';
import {cleanText} from './lib/text.mjs';

const run = (args) => spawnSync(process.execPath, args, {stdio: 'inherit'}).status === 0;
console.log('→ Buscando noticias…');
run(['scripts/news/fetch.mjs']); run(['scripts/news/cluster.mjs']);

const clusters = JSON.parse(fs.readFileSync('data/news/clusters.json', 'utf8'));
const seen = new Set(fs.existsSync('data/news/seen.json') ? JSON.parse(fs.readFileSync('data/news/seen.json', 'utf8')) : []);
const opts = clusters.filter((c) => !seen.has(c.id)).sort((a, b) => (b.level !== 'RADAR') - (a.level !== 'RADAR') || b.count - a.count).slice(0, 8);

console.log('\nNOTICIAS DE HOY (más fuentes primero)\n');
opts.forEach((c, i) => console.log(`${i + 1}. [${c.level === 'OFICIAL' ? 'oficial' : c.level === 'RADAR' ? 'RUMOR' : c.count + ' fuentes'}] ${cleanText(c.headline)}  (${routeCluster(c).series})`));
console.log('\nt = vídeo de tema (técnica/historia) · r = resumen del día · enter = salir');

const rl = readline.createInterface({input: process.stdin, output: process.stdout});
const ans = (await rl.question('\nElige: ')).trim().toLowerCase();
rl.close();
let ok = false;
if (/^\d+$/.test(ans) && opts[+ans - 1]) ok = run(['scripts/agents/make-reels.mjs', `--id=${opts[+ans - 1].id}`]);
else if (ans === 't') {
  const T = JSON.parse(fs.readFileSync('config/evergreen.json', 'utf8'));
  T.forEach((t, i) => console.log(`${i + 1}. ${t.headline ?? t.id}`));
  const rl2 = readline.createInterface({input: process.stdin, output: process.stdout});
  const n = +(await rl2.question('Tema nº: ')); rl2.close();
  if (T[n - 1]) ok = run(['scripts/agents/topic-reel.mjs', `--topic=${T[n - 1].id}`]);
} else if (ans === 'r') ok = run(['scripts/agents/summary-reel.mjs', '--mode=day']);
else process.exit(0);

if (ok) { console.log('\n✓ Listo. Abriendo el panel de revisión: http://localhost:4173'); spawn(process.execPath, ['scripts/review-server.mjs'], {stdio: 'inherit'}); }
