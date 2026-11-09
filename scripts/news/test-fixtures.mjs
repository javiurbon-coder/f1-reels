// Prueba sin red: genera titulares de ejemplo, ejecuta el agrupado y comprueba el resultado.
import fs from 'node:fs';
import {execSync} from 'node:child_process';
import {parseFeed} from './fetch.mjs';

const now = new Date().toISOString();
const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();
// 1) el parser RSS lee un feed de ejemplo
const xml = fs.readFileSync('data/news/fixtures/feed-a.xml', 'utf8').replaceAll('PUBDATE', new Date().toUTCString());
const parsed = parseFeed(xml, {name: 'Motorsport.com ES', lang: 'es'});
console.log('parser:', parsed.length === 2 ? 'OK' : 'FALLO', parsed.map((p) => p.title.slice(0, 40)));

const mk = (source, lang, title, h, link, official = false, tier = official ? 'oficial' : 'medio', group = source.replace(/ ES$/, '')) => ({source, group, tier, lang, official, domain: new URL(link).hostname, title, link, published: ago(h)});
const raw = [
  mk('Formula1.com', 'en', 'Alonso signs Aston Martin extension until 2028', 3, 'https://www.formula1.com/en/latest/article/alonso-extension.1', true),
  mk('Motorsport.com ES', 'es', 'Alonso renueva con Aston Martin hasta 2028', 2, 'https://es.motorsport.com/f1/news/alonso-renueva/1'),
  mk('Diario AS', 'es', 'Fernando Alonso renueva con Aston Martin hasta 2028', 1, 'https://as.com/motor/alonso-renueva-aston-martin-n/'),
  mk('Autosport', 'en', 'Norris says McLaren upgrade package delivers big step at Interlagos', 5, 'https://www.autosport.com/f1/news/norris-upgrade/1'),
  mk('RaceFans', 'en', 'McLaren upgrade package delivers big step says Norris', 4, 'https://www.racefans.net/norris-upgrade/'),
  mk('PlanetF1', 'en', 'Rumour: Hamilton to join a mystery team after Ferrari', 6, 'https://www.planetf1.com/rumour-hamilton'),
  mk('Motorsport.com', 'en', 'Alonso signs Aston Martin extension until 2028', 2.5, 'https://www.motorsport.com/f1/news/alonso-extension/1'),
  mk('Motorsport.com', 'en', 'Alonso signs Aston Martin extension until 2028 (updated)', 2, 'https://www.motorsport.com/f1/news/alonso-extension-2/1'), // misma fuente repetida: no suma
  // periodista + su propio medio = UNA sola fuente (mismo grupo)
  mk('Jorge Peiró', 'es', 'Ocon y Haas rompen su relación antes de fin de temporada según Relevo', 2, 'https://x.com/JPEIR0/status/1', false, 'periodista', 'relevo'),
  mk('Relevo', 'es', 'Ocon y Haas rompen su relación antes de fin de temporada', 2, 'https://www.relevo.com/motor/ocon-haas', false, 'medio', 'relevo'),
  // solo creadores: nunca confirman
  mk('Elkaitz', 'es', 'Rumor Cadillac fichará a Bottas y Pérez para 2027 temporada', 3, 'https://youtube.com/watch?v=1', false, 'creador', 'elkaitz'),
  mk('Nachez', 'es', 'Cadillac fichará a Bottas y Pérez para 2027 temporada', 3, 'https://twitch.tv/nachez/1', false, 'creador', 'nachez'),
  // creador comenta una noticia ya confirmada: aparece como "también lo comentan" pero no sube el nivel
  mk('Elkaitz', 'es', 'Alonso renueva con Aston Martin hasta 2028 mis impresiones', 1, 'https://youtube.com/watch?v=2', false, 'creador', 'elkaitz'),
  mk('Autosport', 'en', 'Old story from last week about Verstappen', 200, 'https://www.autosport.com/old'),
];
fs.writeFileSync('data/news/raw.json', JSON.stringify(raw, null, 2));
execSync('node scripts/news/cluster.mjs', {stdio: 'inherit'});
const c = JSON.parse(fs.readFileSync('data/news/clusters.json', 'utf8'));
const checks = [
  ['Alonso agrupa 3 fuentes (repetidas y mismo grupo no suman)', c.some((x) => /Alonso/.test(x.headline) && x.count === 3 && x.level === 'ALTA')],
  ['Norris agrupa 2 fuentes (MEDIA)', c.some((x) => /Norris/.test(x.headline) && x.count === 2 && x.level === 'MEDIA')],
  ['Rumor con 1 sola fuente NO se publica (queda en RADAR)', c.every((x) => !/Hamilton/.test(x.headline) || x.level === 'RADAR')],
  ['Noticia antigua NO sale', !c.some((x) => /Verstappen/.test(x.headline))],
  ['Todas las fuentes tienen nombre', c.every((x) => [...x.sources, ...x.alsoSay].every((s) => s.name))],
  ['Periodista + su medio cuentan como 1 → no basta (queda en RADAR)', c.some((x) => /Ocon/.test(x.headline) && x.level === 'RADAR' && x.count === 1)],
  ['Solo creadores → RADAR, nunca confirmada', c.some((x) => /Cadillac/.test(x.headline) && x.level === 'RADAR' && x.count === 0)],
  ['Creador no sube el nivel pero sale en "también lo comentan"', c.some((x) => /Alonso/.test(x.headline) && x.count === 3 && x.alsoSay.some((a) => a.name === 'Elkaitz'))],
  ['Prefiere titular en español', c.find((x) => /Alonso/.test(x.headline))?.headlineLang === 'es'],
];
for (const [n, ok] of checks) console.log(ok ? '✓' : '✗', n);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
