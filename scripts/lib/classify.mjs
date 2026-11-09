// Decide a qué serie/plantilla va un grupo de noticias. Reglas simples, sin IA.
const MERCADO = /\b(ficha|fichaje|fichar|firma|firmar|contrato|renueva|renovaci[oó]n|renovar|sustituye|sustituir[aá]|reemplaza|abandona|deja el|salida de|se marcha|asiento|volante|signs?|signing|contract|extends?|extension|joins?|leaves?|replaces?|seat|race seat|confirmed for 20\d\d)\b/i;

export const isMarket = (c) => MERCADO.test(c.headline);

/** → {series, composition} */
export function routeCluster(c) {
  if (c.level === 'RADAR') return {series: 'rumor', composition: 'Rumor'};
  if (isMarket(c)) return {series: 'mercado', composition: 'Mercado'};
  return {series: 'noticias', composition: 'NoticiaVerificada'};
}

export const marketKind = (h) =>
  /renuev|renovaci|extend|extension/i.test(h) ? 'RENOVACIÓN' : /abandona|deja|salida|se marcha|leaves/i.test(h) ? 'SALIDA' : /contrato|contract/i.test(h) ? 'CONTRATO' : 'FICHAJE';

/** Props de cada plantilla a partir del clúster. */
export function propsFor(route, c, fmtDate) {
  const src = (s) => ({name: s.name, domain: s.domain, official: !!s.official, tier: s.tier});
  if (route.composition === 'Rumor') {
    // En un rumor se enseñan TODOS los que lo cuentan (también creadores), nunca se vende como hecho.
    const pool = [...c.sources, ...c.alsoSay];
    return {headline: c.headline, date: fmtDate(c.latest), sources: pool.map(src), alsoSay: []};
  }
  const base = {headline: c.headline, level: c.level, date: fmtDate(c.latest), sources: c.sources.map(src), alsoSay: c.alsoSay.map((s) => s.name)};
  return route.composition === 'Mercado' ? {...base, kind: marketKind(c.headline)} : base;
}

import fs from 'node:fs';
import {strip} from './text.mjs';
let _topics;
export const loadTopics = () => (_topics ??= JSON.parse(fs.readFileSync('config/topics.json', 'utf8')));

/** Temas (pilotos/equipos) que aparecen en el titular o en los titulares de las fuentes. */
export function topicsOf(c) {
  const text = ' ' + strip([c.headline, ...[...c.sources, ...c.alsoSay].map((s) => s.title)].join(' ')) + ' ';
  return Object.entries(loadTopics())
    .filter(([, t]) => t.keywords.some((k) => new RegExp(`\\b${strip(k)}\\b`).test(text)))
    .map(([id]) => id);
}
