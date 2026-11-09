// Convierte las mejores noticias contrastadas en reels y los deja en la cola de revisión.
// Uso: node scripts/news/enqueue-news.mjs
import fs from 'node:fs';
import {enqueue} from '../lib/queue.mjs';

const settings = JSON.parse(fs.readFileSync('config/settings.json', 'utf8'));
const clusters = JSON.parse(fs.readFileSync('data/news/clusters.json', 'utf8'));
const series = {noticias: JSON.parse(fs.readFileSync('config/series.json', 'utf8')).find((s) => s.id === 'noticias')?.hashtags};
const seenFile = 'data/news/seen.json';
const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, 'utf8')) : []);

const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', {day: '2-digit', month: 'short'}).toUpperCase();

let made = 0;
for (const c of clusters) {
  if (made >= settings.maxPerRun) break;
  if (c.level === 'RADAR' || seen.has(c.id)) continue; // lo no confirmado nunca se convierte en reel solo
  const caption =
    `${c.headline}\n\n` +
    `Contrastado por ${c.count} ${c.count === 1 ? 'fuente' : 'fuentes'}:\n` +
    c.sources.map((s) => `• ${s.name}: ${s.url}`).join('\n') +
    (c.alsoSay.length ? `\n\nTambién lo comentan: ${c.alsoSay.map((s) => s.name).join(', ')}` : '') +
    `\n\n${settings.hashtags} ${series.noticias ?? ''}`.trimEnd();
  const props = {
    headline: c.headline,
    level: c.level,
    date: fmtDate(c.latest),
    sources: c.sources.map((s) => ({name: s.name, domain: s.domain, official: !!s.official, tier: s.tier})),
    alsoSay: c.alsoSay.map((s) => s.name),
  };
  try {
    const r = await enqueue({id: c.id, composition: 'NoticiaVerificada', props, caption, sources: c.sources,
      note: c.headlineLang === 'en' ? 'Titular en inglés: tradúcelo/reescríbelo antes de aprobar.' : ''});
    seen.add(c.id);
    made++;
    console.log(`✓ en cola: [${c.level}] ${c.headline}`);
  } catch (e) {
    console.error('✗ falló el render de', c.id, e.message);
  }
}
fs.writeFileSync(seenFile, JSON.stringify([...seen], null, 2));
console.log(`OK → ${made} reel(s) pendientes de revisión. Ejecuta: npm run review`);
