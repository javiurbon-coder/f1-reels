import {theme as T} from './theme';

// Mide texto con el motor real del navegador (canvas) para que NUNCA se salga de su caja ni se pise con otro.
let ctx: CanvasRenderingContext2D | null = null;
export const textWidth = (text: string, size: number, font: string = T.display, weight: string | number = '') => {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * size * 0.7;
  ctx.font = `${weight} ${size}px ${font}`.trim();
  return ctx.measureText(text).width;
};

let W8: string | number = '';
const wrap = (words: string[], size: number, w: number, font: string) => {
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const t = cur ? cur + ' ' + word : word;
    if (cur && textWidth(t, size, font, W8) > w) {
      lines.push(cur);
      cur = word;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
};

/** Reparte las palabras de forma equilibrada (evita una última línea con una sola palabra suelta). */
const balance = (words: string[], size: number, w: number, font: string, lines: string[]) => {
  if (lines.length < 2) return lines;
  let best = lines;
  for (let ww = w - 24; ww > w * 0.45; ww -= 24) {
    if (words.some((x) => textWidth(x, size, font, W8) > ww)) break;
    const t = wrap(words, size, ww, font);
    if (t.length !== lines.length) break;
    best = t;
  }
  return best;
};

export type Fit = {size: number; lines: string[]; height: number};

/** Busca el mayor tamaño de letra (entre max y min) con el que el texto cabe en w×h. Si ni así cabe, recorta con "…". */
export function fitBox(text: string, w: number, h: number, o: {max?: number; min?: number; lh?: number; upper?: boolean; font?: string; weight?: string | number} = {}): Fit {
  const {max = 96, min = 40, lh = 1.08, upper = true, font = T.display, weight = ''} = o;
  W8 = weight;
  const words = (upper ? text.toUpperCase() : text).split(/\s+/).filter(Boolean);
  for (let size = max; size >= min; size -= 2) {
    if (words.some((x) => textWidth(x, size, font, weight) > w)) continue;
    const lines = wrap(words, size, w, font);
    if (lines.length * size * lh <= h) return {size, lines: balance(words, size, w, font, lines), height: lines.length * size * lh};
  }
  const size = min;
  let lines = wrap(words, size, w, font);
  const maxLines = Math.max(1, Math.floor(h / (size * lh)));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && textWidth(last + '…', size, font, weight) > w) last = last.slice(0, -1);
    lines[maxLines - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
  }
  return {size, lines, height: lines.length * size * lh};
}

/** Una sola línea que ocupa como mucho `w` píxeles. */
export const fitOneLine = (text: string, w: number, max: number, min = 20, font: string = T.display, weight: string | number = '', upper = true) => {
  const t = upper ? text.toUpperCase() : text;
  for (let s = max; s >= min; s -= 2) if (textWidth(t, s, font, weight) <= w) return s;
  return min;
};
