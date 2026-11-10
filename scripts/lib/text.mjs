// Utilidades de texto para comparar titulares (sin IA: coincidencia de palabras).
const STOP = new Set(
  ('el la los las un una unos unas de del al y o u e en con por para que se su sus lo le les es son ser fue ha han hay no si mas ya como pero sobre entre tras hasta desde ante bajo este esta estos estas ese esa asi muy tambien segun nuevo nueva ' +
    'the a an of to in on at for and or but is are was were be been has have had will with by from as it its this that these those after before over into out up about says say said new report reports ' +
    'f1 formula one gp grand prix 2025 2026 2027').split(' '),
);

export const strip = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function tokens(title) {
  return new Set(
    strip(title)
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((t) => t.replace(/-/g, ''))
      .filter((t) => t && !STOP.has(t) && (t.length >= 4 || /^\d+$/.test(t)))
      .map((t) => (t.length > 5 ? t.replace(/(es|s)$/, '') : t)),
  );
}

export function similar(a, b, {minShared, minOverlap}) {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const overlap = shared / Math.min(a.size, b.size || 1);
  return shared >= minShared && overlap >= minOverlap;
}

const ENT = {amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”'};
export const decode = (s) =>
  String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

export const clean = (s = '') => decode(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

export const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

// Texto seguro para dibujar en el vídeo: solo caracteres que las tipografías del reel (Archivo Black, Space Mono) tienen.
// Quita emojis, símbolos raros, caracteres invisibles y alfabetos no latinos; normaliza comillas y guiones.
export function cleanText(s) {
  if (typeof s !== 'string') return s;
  return s
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/[\u00A0\u2009\u202F\u3000]/g, ' ')
    .replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\uFE0F\u2060]/g, '')
    .replace(/[^\p{Script=Latin}\p{N}\p{P}\p{Zs}\u00BF\u00A1\u20AC\u00A3\u00B7\u2022\u2192+=%$]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
export const cleanDeep = (v) => (typeof v === 'string' ? cleanText(v) : Array.isArray(v) ? v.map(cleanDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cleanDeep(x)])) : v);
