// Descarga los feeds RSS/Atom configurados y guarda data/news/raw.json. No usa IA.
// Uso: node scripts/news/fetch.mjs [archivo_xml_local_para_pruebas]
import fs from 'node:fs';
import {XMLParser} from 'fast-xml-parser';
import {clean, hostOf} from '../lib/text.mjs';

const people = fs.existsSync('config/people.json') ? JSON.parse(fs.readFileSync('config/people.json', 'utf8')) : [];
// medios + personas que tengan feed RSS/Atom (p. ej. canal de YouTube). Sin feed → se ignoran aquí (ver add-lead.mjs).
const feeds = [
  ...JSON.parse(fs.readFileSync('config/feeds.json', 'utf8')),
  ...people.filter((p) => p.feed).map((p) => ({name: p.name, url: p.feed, group: p.group ?? p.name, tier: p.tier, lang: 'es'})),
];
const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '@_'});
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

const txt = (v) => (v && typeof v === 'object' ? (v['#text'] ?? '') : String(v ?? ''));

export function parseFeed(xml, feed) {
  const j = parser.parse(xml);
  const items = arr(j?.rss?.channel?.item).length ? arr(j.rss.channel.item) : arr(j?.feed?.entry);
  return items
    .map((it) => {
      const link = typeof it.link === 'string' ? it.link : (arr(it.link).find((l) => l['@_rel'] !== 'self') ?? arr(it.link)[0])?.['@_href'] ?? it.guid?.['#text'] ?? it.guid;
      const date = new Date(it.pubDate ?? it.published ?? it.updated ?? it['dc:date'] ?? Date.now());
      return {
        source: feed.name,
        group: feed.group ?? feed.name, // medios del mismo grupo cuentan como UNA fuente
        official: !!feed.official,
        tier: feed.tier ?? (feed.official ? 'oficial' : 'medio'), // oficial | medio | periodista | creador
        lang: feed.lang,
        domain: hostOf(link),
        title: clean(typeof it.title === 'object' ? it.title['#text'] : it.title),
        summary: clean(txt(it.description ?? it.summary ?? it['content:encoded'] ?? '')).slice(0, 600),
        link,
        published: isNaN(date) ? new Date().toISOString() : date.toISOString(),
      };
    })
    .filter((x) => x.title && x.link);
}

const isF1 = (t) => {
  const s = t.toLowerCase();
  return settings.f1Keywords.some((k) => s.includes(k));
};

async function getFeed(feed) {
  const res = await fetch(feed.url, {
    headers: {'User-Agent': 'f1-reels/1.0 (lector RSS personal)'},
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text(), feed);
}

if (process.argv[1].endsWith('fetch.mjs')) {
  const local = process.argv[2];
  const all = [];
  if (local) {
    all.push(...parseFeed(fs.readFileSync(local, 'utf8'), {name: 'Local', lang: 'es'}));
  } else {
    const results = await Promise.allSettled(feeds.map(getFeed));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`✓ ${feeds[i].name}: ${r.value.length} titulares`);
        all.push(...r.value);
      } else console.warn(`✗ ${feeds[i].name}: ${r.reason?.message ?? r.reason}  (revisa la URL en config/feeds.json)`);
    });
  }
  // pistas añadidas a mano (tuits, directos, etc.): data/news/manual.json
  if (!local && fs.existsSync('data/news/manual.json')) all.push(...JSON.parse(fs.readFileSync('data/news/manual.json', 'utf8')));
  // Fuera lo que no es noticia: directos, encuestas, podcasts, vídeos, "valora la carrera"...
  const NOISE = /^(as it happened|live[:\s]|watch[:\s]|listen[:\s]|video[:\s]|podcast|quiz|poll|rate the race|f1 nation|en directo|directo[:\s])|\b(rate the race|as it happened|live updates|live blog|podcast|vota|encuesta)\b/i;
  const f1 = all.filter((x) => isF1(x.title) && !NOISE.test(x.title));
  fs.mkdirSync('data/news', {recursive: true});
  fs.writeFileSync('data/news/raw.json', JSON.stringify(f1, null, 2));
  console.log(`OK → data/news/raw.json (${f1.length} titulares de F1 de ${all.length})`);
}
