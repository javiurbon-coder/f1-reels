// AGENTE DIRECTOR (sin IA, determinista): reparte el guion en ESCENAS sincronizadas con la voz
// y decide qué gráfica de datos acompaña a cada frase. Devuelve [{type, from, to, ...}] en segundos.
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RATE = 2.6; // palabras/segundo si no hay voz (solo para planificar)

export const splitSentences = (script) => script.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);

/** Frases con su inicio/fin en segundos, a partir de los tiempos por palabra. */
export function timeSentences(script, words) {
  let i = 0;
  return splitSentences(script).map((text) => {
    const n = text.split(/\s+/).filter(Boolean).length;
    const w0 = words[Math.min(i, words.length - 1)], w1 = words[Math.min(i + n - 1, words.length - 1)];
    i += n;
    return {text, start: w0.start, end: w1.end};
  });
}

export const clip = (t, max = 118) => {
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const comma = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(': '));
  return (comma > 55 ? cut.slice(0, comma) : cut.replace(/\s+\S*$/, '')).replace(/[,:;\s]+$/, '') + '…';
};

export const iconFor = (t) => {
  const s = norm(t);
  if (/(gano|victori|podio|campe|titul|trofeo|lider)/.test(s)) return 'trophy';
  if (/(vuelta|tiempo|segundo|crono|rapid|ritmo|decima|minuto)/.test(s)) return 'stopwatch';
  if (/(contrato|ficha|firma|renov|acuerdo|temporada 20|hasta 20)/.test(s)) return 'doc';
  if (/(coche|motor|aleron|neumatic|mejora|pieza|tecnic|reglamento|monoplaza|actualiz)/.test(s)) return 'wrench';
  return 'flag';
};

/** Palabras a resaltar: nombres propios (no la 1ª de la frase) y cifras. */
export const pickHl = (t) => {
  const w = t.replace(/[¡¿]/g, '').split(/\s+/);
  const hit = w.slice(1).filter((x) => /^(\p{Lu}[\p{L}]{3,}|\d[\d.,º%]*)/u.test(x)).map((x) => x.replace(/[^\p{L}\d]/gu, ''));
  return [...new Set(hit)].slice(0, 2);
};

const score = (fact, text) => {
  const s = norm(text);
  return fact.keys.filter((k) => s.includes(norm(k))).length;
};

/**
 * @param {{script:string, words:{t:string,start:number,end:number}[], seconds:number, facts?:any[]}} a
 * @returns {{scenes:any[], total:number}}
 */
export function direct({script, words, seconds, facts = []}) {
  const total = +(seconds + 0.8).toFixed(2);
  const sents = timeSentences(script, words);
  const hookEnd = Math.min(7, Math.max(3.2, sents[0]?.end ?? 3.5));
  // Las fuentes empiezan en la frase de "quién lo cuenta" (entre las 2 últimas) y duran al menos 5 s.
  const WHO = /(cuent|confirm|fuente|medios|inform|public)/i;
  let wi = sents.length - 1;
  if (sents.length > 2 && WHO.test(sents[sents.length - 2].text)) wi = sents.length - 2;
  const srcFrom = +Math.max(hookEnd + 2.4, Math.min(sents[wi]?.start ?? total - 6, total - 5)).toFixed(2);

  // Bloques centrales: frases entre el gancho y las fuentes; si una dura poco, se une a la siguiente.
  let mid = sents.slice(1, wi).map((s) => ({...s}));
  const merged = [];
  for (const b of mid) {
    const last = merged[merged.length - 1];
    if (last && (last.end - last.start < 2.6 || b.end - b.start < 1.6)) { last.text += ' ' + b.text; last.end = b.end; } else merged.push(b);
  }
  mid = merged;

  // Se reparten las gráficas: la frase que más encaja con cada hallazgo (≥2 coincidencias) se queda con él.
  const left = [...facts];
  const blocks = mid.map((b) => ({...b, fact: null}));
  for (const f of [...left]) {
    let best = -1, bs = 1;
    blocks.forEach((b, i) => { const sc = score(f, b.text); if (!b.fact && sc > bs) { bs = sc; best = i; } });
    if (best >= 0 && blocks.filter((b) => b.fact).length < 3) { blocks[best].fact = f; left.splice(left.indexOf(f), 1); }
  }
  // Hallazgos sin frase propia: se parte una frase larga en [texto | gráfica]; si no hay, se usa un bloque sin gráfica.
  const out = [];
  for (const b of blocks) {
    const dur = b.end - b.start;
    if (!b.fact && left.length && blocks.filter((x) => x.fact).length + out.filter((o) => o.fact).length < 3) {
      if (dur >= 5.5) {
        const cut = +(b.start + dur * 0.45).toFixed(2);
        out.push({text: b.text, start: b.start, end: cut, fact: null}, {text: b.text, start: cut, end: b.end, fact: left.shift()});
        continue;
      }
      b.fact = left.shift();
    }
    out.push(b);
  }

  const scenes = [{type: 'hook', from: 0, to: hookEnd}];
  const body = out.filter((b) => b.start < srcFrom - 0.5);
  const ICONS = ['flag', 'stopwatch', 'trophy', 'doc', 'wrench'];
  let prevIcon = null;
  body.forEach((b, i) => {
    const from = i === 0 ? hookEnd : b.start;
    const to = i === body.length - 1 ? srcFrom : Math.min(body[i + 1].start, srcFrom);
    if (to - from < 1.2) return;
    if (b.fact) scenes.push({...b.fact.scene, from: +from.toFixed(2), to: +to.toFixed(2)});
    else {
      let icon = iconFor(b.text);
      if (icon === prevIcon) icon = ICONS[(ICONS.indexOf(icon) + 1) % ICONS.length]; // no repetir el mismo icono dos escenas seguidas
      prevIcon = icon;
      scenes.push({type: 'point', text: clip(b.text), hl: pickHl(b.text), icon, from: +from.toFixed(2), to: +to.toFixed(2)});
    }
  });
  // Sin frases centrales: un hueco entre el gancho y las fuentes se rellena con la mejor gráfica o con el titular
  if (scenes.length === 1 && srcFrom - hookEnd > 2) {
    const f = left.shift();
    scenes.push(f ? {...f.scene, from: hookEnd, to: srcFrom} : {type: 'point', text: clip(sents[1]?.text ?? sents[0].text), hl: [], icon: 'flag', from: hookEnd, to: srcFrom});
  }
  // continuidad: cada escena empieza donde acaba la anterior
  for (let i = 1; i < scenes.length; i++) scenes[i].from = scenes[i - 1].to;
  scenes.push({type: 'sources', from: scenes[scenes.length - 1].to, to: total});
  return {scenes, total};
}

/* =================== DISEÑO v2: del storyboard básico a las escenas del sistema nuevo =================== */
const LEAD = /^(adem[aá]s|por otro lado|por su parte|y|pero|eso s[ií]|mientras tanto|as[ií]|tambi[eé]n|ahora|de hecho|sin embargo|por ahora),?\s+/i;
const cap1 = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Frase → fila de lista: título corto + subtítulo (solo se recorta el texto del guion; no se añade nada). */
export function rowFrom(text) {
  const t = cap1(text.replace(/[.!?…]+$/, '').replace(/[¡¿]/g, '').replace(LEAD, '').trim());
  if (t.length <= 34) return {title: t};
  let cut = -1;
  for (const m of t.matchAll(/, | que | y | pero | porque | para | tras | con | en | de /g)) if (m.index >= 14 && m.index <= 34) cut = m.index;
  if (cut < 0) cut = t.lastIndexOf(' ', 34);
  const title = t.slice(0, cut).replace(/[,\s]+$/, '');
  let sub = cap1(t.slice(cut).replace(/^[,\s]+/, ''));
  if (sub.length > 50) sub = sub.slice(0, 48).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '…';
  return {title, sub};
}

const isYear = (s) => /^(19|20)\d\d$/.test(String(s));

/**
 * @param {any[]} scenes escenas de direct() · @param {{series?:string, market?:object, rumor?:object}} ctx
 * @returns escenas v2: hook | list | dato | mercado | rumor | sources
 */
export function toV2(scenes, ctx = {}) {
  const out = [];
  for (const s of scenes) {
    const {from, to} = s;
    if (s.type === 'hook' || s.type === 'sources') out.push({type: s.type, from, to});
    else if (s.type === 'bars') {
      const me = s.rows.find((r) => r.me) ?? s.rows[0];
      const gain = me.grid - me.finish;
      const years = s.rows.every((r) => isYear(r.name));
      out.push({type: 'dato', from, to, value: gain > 0 ? `+${gain}` : `${gain}`, label: `posiciones: de ${me.grid}º a ${me.finish}º${years ? ` en ${me.name}` : ''}`,
        chartTitle: years ? s.title : 'De la parrilla a la meta', maxPos: Math.max(...s.rows.flatMap((r) => [r.grid, r.finish])) > 10 ? 22 : 10,
        rows: s.rows.slice(0, 5).map((r) => ({...r, ...(years ? {tag: `${r.finish}º`} : {})}))});
    } else if (s.type === 'stat') {
      out.push({type: 'dato', from, to, value: /posici/i.test(s.label) && s.value > 0 ? `+${s.value}` : `${s.value}`, label: s.label, rows: []});
    } else if (s.type === 'point') {
      const last = out[out.length - 1];
      const row = {icon: s.icon ?? 'flag', ...rowFrom(s.text)};
      if (last?.type === 'list' && last.rows.length < 4 && to - last.from <= 22) { last.rows.push({...row, at: +(from - last.from).toFixed(2)}); last.to = to; }
      else out.push({type: 'list', from, to, rows: [{...row, at: 0.3}]});
    }
  }
  for (let k = 1; k < out.length; k++) out[k - 1].to = out[k].from; // sin huecos si se descartó alguna escena
  // Escena propia de la serie (mercado / rumor): ocupa el tiempo de la primera frase de la primera lista.
  const special = ctx.market ? {type: 'mercado', ...ctx.market} : ctx.rumor ? {type: 'rumor', ...ctx.rumor} : null;
  const i = out.findIndex((s) => s.type === 'list');
  if (special && i >= 0) {
    const l = out[i];
    if (l.rows.length >= 2 && l.rows[1].at >= 2.5) {
      const cut = +(l.from + l.rows[1].at).toFixed(2);
      const rest = {...l, from: cut, rows: l.rows.slice(1).map((r, k) => ({...r, at: k === 0 ? 0.3 : +(r.at - l.rows[1].at).toFixed(2)}))};
      out.splice(i, 1, {...special, from: l.from, to: cut}, rest);
    } else out.splice(i, 1, {...special, from: l.from, to: l.to});
  }
  return out;
}
