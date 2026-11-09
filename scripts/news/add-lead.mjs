// Añade a mano una pista (p. ej. un tuit de un periodista o lo que dice un streamer).
// X/Twitter no tiene lectura gratuita por API, así que esta es la vía legítima y gratis.
// Uso: node scripts/news/add-lead.mjs "<autor>" "<url>" "<texto/titular>" [tier]
//   tier opcional: oficial | medio | periodista | creador (si no, se toma de config/people.json)
import fs from 'node:fs';
import {hostOf} from '../lib/text.mjs';

const [author, link, text, tierArg] = process.argv.slice(2);
if (!author || !link || !text) {
  console.error('Uso: node scripts/news/add-lead.mjs "<autor>" "<url>" "<texto>" [tier]');
  process.exit(1);
}
const people = fs.existsSync('config/people.json') ? JSON.parse(fs.readFileSync('config/people.json', 'utf8')) : [];
const p = people.find((x) => x.name.toLowerCase() === author.toLowerCase() || (x.handle && x.handle.toLowerCase() === author.toLowerCase()));
const tier = tierArg ?? p?.tier ?? 'creador'; // sin conocerlo, el nivel más prudente
const file = 'data/news/manual.json';
const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
list.push({source: p?.name ?? author, group: p?.group ?? author, tier, official: false, lang: 'es', domain: hostOf(link), title: text, link, published: new Date().toISOString()});
fs.writeFileSync(file, JSON.stringify(list, null, 2));
console.log(`OK → pista de ${p?.name ?? author} (${tier}) guardada. Se tendrá en cuenta en el próximo "npm run news".`);
