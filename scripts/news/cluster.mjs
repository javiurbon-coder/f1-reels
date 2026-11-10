// Agrupa titulares que hablan de lo mismo y exige varias fuentes INDEPENDIENTES.
// Entrada: data/news/raw.json  ·  Salida: data/news/clusters.json
// Limitación: compara palabras, no significado. Por eso todo pasa por revisión humana.
import fs from 'node:fs';
import {tokens, similar} from '../lib/text.mjs';

const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('data/news/raw.json', 'utf8'));
const since = Date.now() - settings.windowHours * 3600_000;

const items = raw
  .filter((x) => new Date(x.published).getTime() >= since)
  .map((x) => ({...x, tok: tokens(x.title)}))
  .filter((x) => x.tok.size >= 3)
  .sort((a, b) => new Date(a.published) - new Date(b.published));

const clusters = [];
for (const it of items) {
  const home = clusters.find((c) => c.items.some((m) => similar(it.tok, m.tok, settings.similarity)));
  if (home) home.items.push(it);
  else clusters.push({items: [it]});
}

// Quién puede CONFIRMAR una noticia: oficial, medio y periodista. Los creadores solo "también lo comentan".
const CONFIRMS = new Set(['oficial', 'medio', 'periodista']);
const out = clusters
  .map((c) => {
    // una fuente (o grupo editorial) cuenta una sola vez: un periodista y su medio, o dos webs del mismo grupo, son UNA
    const byGroup = new Map();
    const confirming = c.items.filter((m) => CONFIRMS.has(m.tier ?? 'medio'));
    for (const m of confirming) if (!byGroup.has(m.group ?? m.source)) byGroup.set(m.group ?? m.source, m);
    const sources = [...byGroup.values()];
    const also = new Map();
    for (const m of c.items) if (!CONFIRMS.has(m.tier ?? 'medio') && !byGroup.has(m.group ?? m.source)) also.set(m.group ?? m.source, m);
    const n = sources.length;
    const official = sources.some((s) => s.tier === 'oficial');
    let level = 'RADAR'; // sin confirmación suficiente: no se publica sola
    if (n >= 3) level = 'ALTA';
    else if (n === 2) level = 'MEDIA';
    else if (official && settings.allowSingleOfficial) level = 'OFICIAL';
    const pool = sources.length ? sources : [...also.values()];
    // titular propuesto: prioriza español, luego el más corto (más "limpio")
    const pick = [...pool].sort((a, b) => (b.lang === 'es') - (a.lang === 'es') || a.title.length - b.title.length)[0];
    const view = (s) => ({summary: s.summary ?? '', name: s.source, domain: s.domain, url: s.link, title: s.title, lang: s.lang, published: s.published, tier: s.tier ?? 'medio', official: s.tier === 'oficial', manual: !!s.manual});
    return {
      id: 'n-' + Buffer.from(pool.map((s) => s.link).sort()[0]).toString('base64url').slice(-14),
      level,
      count: n,
      headline: pick.title,
      headlineLang: pick.lang,
      latest: pool.map((s) => s.published).sort().pop(),
      sources: sources.map(view),
      alsoSay: [...also.values()].map(view),
    };
  })
  .sort((a, b) => (b.level !== 'RADAR') - (a.level !== 'RADAR') || b.count - a.count || new Date(b.latest) - new Date(a.latest));

fs.writeFileSync('data/news/clusters.json', JSON.stringify(out, null, 2));
const ok = out.filter((c) => c.level !== 'RADAR');
console.log(`OK → data/news/clusters.json: ${ok.length} contrastadas + ${out.length - ok.length} en radar (sin confirmar, NO se publican solas)`);
for (const c of ok.slice(0, 8)) console.log(`  [${c.level} · ${c.count}] ${c.headline}`);
