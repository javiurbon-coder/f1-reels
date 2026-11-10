// Editor táctil del panel: muestra el fotograma REAL del reel (mismo código que el vídeo final).
// Pulsas un texto en el fotograma y lo editas ahí mismo. Se empaqueta al vuelo con esbuild desde review-server.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Player, type PlayerRef} from '@remotion/player';
import '../../src/fonts';
import {Reel, reelDuration, type ReelProps} from '../../src/v2/Reel';

const FPS = 30;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const SKIP = new Set(['type', 'icon', 'color', 'teamColor', 'domain', 'file', 'kind', 'from', 'to', 'at', 'grid', 'finish', 'n', 'me', 'official', 'tier', 'tag', 'maxPos', 'seconds']);

type Cand = {path: string; text: string};
/** Textos editables de la escena actual (+ los del reel que salen en la portada). */
function candidates(p: ReelProps, t: number): Cand[] {
  const out: Cand[] = [];
  const walk = (o: any, path: string) => {
    if (typeof o === 'string') { if (o.trim()) out.push({path, text: o}); return; }
    if (Array.isArray(o)) { o.forEach((v, i) => walk(v, path + '.' + i)); return; }
    if (o && typeof o === 'object') for (const k of Object.keys(o)) if (!SKIP.has(k)) walk(o[k], path ? path + '.' + k : k);
  };
  const si = p.scenes.findIndex((s) => t >= s.from && t < s.to);
  const idx = si < 0 ? p.scenes.length - 1 : si;
  walk(p.scenes[idx], 'scenes.' + idx);
  for (const k of ['headline', 'hl', 'chip', 'section', 'date'] as const) if (typeof p[k] === 'string') out.push({path: k, text: p[k] as string});
  p.sources.forEach((s, i) => out.push({path: 'sources.' + i + '.name', text: s.name}));
  return out;
}

function pick(cands: Cand[], el: Element | null, root: Element): Cand | null {
  // 1) un elemento (o su ancestro cercano) cuyo texto coincide EXACTO con un campo
  let e: Element | null = el;
  for (let up = 0; e && e !== root && up < 7; up++, e = e.parentElement) {
    const tx = norm(e.textContent ?? '');
    if (!tx) continue;
    const hit = cands.find((c) => norm(c.text) === tx);
    if (hit) return hit;
  }
  // 2) el texto pulsado es parte de un campo (p. ej. una palabra de un titular)
  const tx = norm(el?.textContent ?? '');
  if (tx.length >= 2) {
    const inc = cands.filter((c) => norm(c.text).includes(tx)).sort((a, b) => a.text.length - b.text.length);
    if (inc[0]) return inc[0];
  }
  return null;
}

/** Subtítulo: busca el tramo de palabras del guion cuyo texto coincide con el elemento (el más grande posible). */
function wordPick(p: ReelProps, el: Element, root: Element): {c: Cand; tgt: Element} | null {
  const W = p.words ?? [];
  let best: {c: Cand; tgt: Element} | null = null;
  let e: Element | null = el;
  for (let up = 0; e && e !== root && up < 7; up++, e = e.parentElement) {
    const tx = norm(e.textContent ?? '');
    if (!tx) continue;
    for (let a = 0; a < W.length; a++) {
      let j = '';
      for (let b = a; b < W.length && j.length <= tx.length; b++) {
        j = (j ? j + ' ' : '') + norm(W[b].t);
        if (j === tx) { best = {c: {path: 'words:' + a + '-' + b, text: W.slice(a, b + 1).map((w) => w.t).join(' ')}, tgt: e}; break; }
      }
    }
  }
  return best;
}

type Ctl = {
  setProps(p: ReelProps): void;
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  play(): void;
  pause(): void;
  destroy(): void;
};

type Opts = {props: ReelProps; onEdit: (path: string, value: string) => void};

const App: React.FC<{init: ReelProps; onEdit: Opts['onEdit']; reg: (c: {setProps: (p: ReelProps) => void; ref: React.RefObject<PlayerRef>}) => void}> = ({init, onEdit, reg}) => {
  const [props, setProps] = React.useState<ReelProps>(init);
  const ref = React.useRef<PlayerRef>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{x: number; y: number; w: number; h: number} | null>(null);
  const [draft, setDraft] = React.useState('');
  const [edit, setEdit] = React.useState<{path: string; x: number; y: number; w: number; h: number; fs: number; multi: boolean} | null>(null);
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => { reg({setProps: (p) => setProps({...p}), ref}); }, []);

  const hit = (ev: React.MouseEvent) => {
    const root = box.current!;
    const els = document.elementsFromPoint(ev.clientX, ev.clientY).filter((e) => root.contains(e) && e !== root && !(e as HTMLElement).dataset.ov);
    const t = (ref.current?.getCurrentFrame() ?? 0) / FPS;
    const cands = candidates(props, t);
    for (const el of els) {
      // solo elementos que tengan texto propio
      if (![...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim())) {
        if (!(el.textContent ?? '').trim()) continue;
      }
      const c = pick(cands, el, root);
      if (c) {
        // rectángulo del elemento con el texto exacto (el más cercano que coincide)
        let e: Element | null = el, tgt: Element = el;
        for (let up = 0; e && e !== root && up < 7; up++, e = e.parentElement) if (norm(e.textContent ?? '') === norm(c.text)) { tgt = e; break; }
        const r = tgt.getBoundingClientRect(), b = root.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(tgt).fontSize) * (b.width / 1080);
        return {c, x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, fs};
      }
    }
    for (const el of els) {
      const w = wordPick(props, el, root);
      if (w) {
        const r = w.tgt.getBoundingClientRect(), b = root.getBoundingClientRect();
        return {c: w.c, x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, fs: parseFloat(getComputedStyle(w.tgt).fontSize) * (b.width / 1080)};
      }
    }
    return null;
  };
  const get = (path: string): string => path.startsWith('words:') ? (() => { const [a, b] = path.slice(6).split('-').map(Number); return (props.words ?? []).slice(a, b + 1).map((w) => w.t).join(' '); })() : path.split('.').reduce((o: any, k) => (o ? o[k] : undefined), props) ?? '';

  return (
    <div ref={box} style={{position: 'relative', width: '100%', height: '100%'}}
      onMouseMove={(ev) => { if (edit) return; const h = hit(ev); setHover(h ? {x: h.x, y: h.y, w: h.w, h: h.h} : null); }}
      onMouseLeave={() => setHover(null)}
      onClick={(ev) => {
        if (edit) return;
        ref.current?.pause();
        const h = hit(ev);
        if (!h) { setMsg('Ahí no hay texto que editar.'); setTimeout(() => setMsg(''), 2500); return; }
        setHover(null);
        setDraft(h.c.text); setEdit({path: h.c.path, x: h.x, y: h.y, w: h.w, h: h.h, fs: h.fs, multi: h.c.text.length > 28});
      }}>
      <Player ref={ref} component={Reel as any} inputProps={props as any} durationInFrames={reelDuration(props)} fps={FPS} compositionWidth={1080} compositionHeight={1920}
        style={{width: '100%', height: '100%'}} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} acknowledgeRemotionLicense />
      {hover && !edit && <div data-ov="1" style={{position: 'absolute', left: hover.x - 4, top: hover.y - 4, width: hover.w + 8, height: hover.h + 8, border: '3px solid #ffd21f', borderRadius: 6, pointerEvents: 'none', background: '#ffd21f22'}} />}
      {edit && (
        <>
          <div data-ov="1" onClick={() => setEdit(null)} style={{position: 'absolute', inset: 0, background: '#0007'}} />
          {React.createElement(edit.multi ? 'textarea' : 'input', {
            'data-ov': '1', autoFocus: true, value: draft,
            onChange: (e: any) => {
              const v: string = e.target.value; setDraft(v); onEdit(edit.path, v);
              if (edit.path.startsWith('words:')) { const a = Number(edit.path.slice(6).split('-')[0]); const k = Math.max(1, v.trim().split(/\s+/).filter(Boolean).length); setEdit({...edit, path: 'words:' + a + '-' + (a + k - 1)}); }
            },
            onKeyDown: (e: any) => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); setEdit(null); } },
            style: {position: 'absolute', left: Math.max(6, Math.min(edit.x - 8, (box.current?.clientWidth ?? 400) - Math.max(220, edit.w) - 14)), top: Math.max(6, edit.y - 6), width: Math.max(220, edit.w + 16), minHeight: edit.h + 12,
              fontSize: Math.max(16, Math.min(edit.fs, 34)), fontFamily: 'Archivo, system-ui, sans-serif', fontWeight: 800, padding: '6px 10px', border: '3px solid #ffd21f', borderRadius: 8, background: '#fff', color: '#111', outline: 'none', zIndex: 5, resize: 'none'},
          })}
          <div data-ov="1" style={{position: 'absolute', left: 8, right: 8, bottom: 8, textAlign: 'center', color: '#fff', font: '600 14px system-ui', zIndex: 5}}>{edit.path.startsWith('words:') ? 'Subtítulo: cambia solo el texto, la voz no cambia · ' : ''}Enter o clic fuera = listo</div>
        </>
      )}
      {msg && <div data-ov="1" style={{position: 'absolute', left: 8, right: 8, bottom: 8, textAlign: 'center', background: '#000c', color: '#fff', padding: '8px', borderRadius: 8, font: '600 14px system-ui'}}>{msg}</div>}
    </div>
  );
};

(window as any).F1Editor = {
  mount(el: HTMLElement, {props, onEdit}: Opts): Ctl {
    const root = createRoot(el);
    let api: {setProps: (p: ReelProps) => void; ref: React.RefObject<PlayerRef>} | null = null;
    let pending: ReelProps | null = null;
    root.render(<App init={props} onEdit={onEdit} reg={(a) => { api = a; if (pending) { a.setProps(pending); pending = null; } }} />);
    const pl = () => api?.ref.current ?? null;
    let dur = reelDuration(props) / FPS;
    return {
      setProps(p) { dur = reelDuration(p) / FPS; if (api) api.setProps(p); else pending = p; },
      get currentTime() { return (pl()?.getCurrentFrame() ?? 0) / FPS; },
      set currentTime(t: number) { pl()?.seekTo(Math.max(0, Math.round(t * FPS))); },
      get duration() { return dur; },
      get paused() { return !(pl()?.isPlaying() ?? false); },
      play() { pl()?.play(); },
      pause() { pl()?.pause(); },
      destroy() { setTimeout(() => root.unmount(), 0); },
    };
  },
};
