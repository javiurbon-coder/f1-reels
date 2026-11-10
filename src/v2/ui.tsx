// SISTEMA DE DISEÑO v2 — piezas comunes a todos los reels.
// Zonas fijas de un reel 1080×1920 (así nada se pisa nunca):
//   cabecera 96-190 · frase narrada 215-430 · objeto central 470-1490 · firma 1515-1560 · (Instagram tapa >1590)
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import '../fonts';
import {Mascot, useIn} from '../kit';
import {theme as T} from '../theme';
import {fitBox, fitOneLine} from '../fit';

export const W = T.width - T.safeX * 2; // 952
export const ZONE = {cap: 215, capH: 215, obj: 470, objH: 1020, sign: 1515};
export const INK = T.ink;

/** Paleta por tipo de reel: [fondo, franja, acento]. */
export const KINDS = {
  noticia: {a: '#62d9a8', b: '#8fe7c2', accent: '#ff4f9a', tag: 'Última hora'},
  dato: {a: '#7cc0ff', b: '#a6d5ff', accent: '#ff4f9a', tag: 'El dato'},
  resultado: {a: '#ffd21f', b: '#ffe36e', accent: '#ff3b1d', tag: 'Resultado'},
  mercado: {a: '#c3a6ff', b: '#d9c7ff', accent: '#ff4f9a', tag: 'Mercado'},
  rumor: {a: '#ff9d3c', b: '#ffb96e', accent: '#111111', tag: 'Rumor'},
  tecnico: {a: '#143a73', b: '#184482', accent: '#4de1ff', tag: 'Cómo funciona'},
  fuentes: {a: '#f6e8c8', b: '#fbf1da', accent: '#1fa95b', tag: 'Fuentes'},
  // presentación de la cuenta
  intro: {a: '#ff9d3c', b: '#ffb96e', accent: '#111111', tag: 'Presentación'},
  menu: {a: '#62d9a8', b: '#8fe7c2', accent: '#ff4f9a', tag: 'La cuenta'},
  reglas: {a: '#f6e8c8', b: '#fbf1da', accent: '#1fa95b', tag: 'Las reglas'},
  cta: {a: '#ffd21f', b: '#ffe36e', accent: '#ff3b1d', tag: 'Síguenos'},
} as const;
export type Kind = keyof typeof KINDS;
/** Nombre de la sección del reel (Técnica, Última hora, Resumen del día…). Si no se indica, se usa la etiqueta del tipo. */
export const SectionCtx = React.createContext<string | undefined>(undefined);
/** Etiquetas de la portada que el usuario ha quitado (hide) y textos que ha cambiado (txt). */
export const EditCtx = React.createContext<{hide: string[]; txt: Record<string, string>}>({hide: [], txt: {}});

/* ---------- fondo: franjas diagonales en movimiento ---------- */
export const Bg: React.FC<{kind: Kind}> = ({kind}) => {
  const frame = useCurrentFrame();
  const {a, b} = KINDS[kind];
  const t = ((frame * 1.2) % 170) * 0.7071;
  return (
    <AbsoluteFill style={{background: a, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: -1300, top: -1300, width: 4600, height: 4600, transform: `translate(${t}px, ${t}px)`, backgroundImage: `repeating-linear-gradient(135deg, ${a} 0 85px, ${b} 85px 170px)`}} />
      {kind === 'tecnico' && (
        <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.09) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.09) 2px, transparent 2px)', backgroundSize: '60px 60px'}} />
      )}
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 45%, transparent 45%, rgba(0,0,0,0.13) 100%)'}} />
    </AbsoluteFill>
  );
};

/* ---------- cabecera: marca + etiqueta del tipo de reel ---------- */
export const Brand: React.FC<{kind: Kind; hideTag?: boolean}> = ({kind, hideTag}) => {
  const p = useIn(0);
  const dark = kind === 'tecnico';
  const section = React.useContext(SectionCtx) ?? KINDS[kind].tag;
  return (
    <div style={{position: 'absolute', top: 96, left: T.safeX, width: W, height: 94, display: 'flex', alignItems: 'center', gap: 14, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [-30, 0])}px)`}}>
      <Mascot size={88} />
      <div style={{fontFamily: T.display, fontSize: 34, color: dark ? T.white : INK, lineHeight: 1, flex: 1}}>{T.brand}</div>
      {!hideTag && <div style={{fontFamily: T.body, fontWeight: 800, fontSize: 28, letterSpacing: 1.5, textTransform: 'uppercase', background: INK, color: T.white, borderRadius: 999, padding: '10px 24px', border: dark ? `3px solid ${T.white}` : 'none'}}>{section}</div>}
    </div>
  );
};

/* ---------- frase narrada: lo que dice la voz, con la palabra actual recuadrada ---------- */
const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\d]/gu, '').toLowerCase();

export const Caption: React.FC<{text: string; on?: string | number; kind: Kind}> = ({text, on, kind}) => {
  const dark = kind === 'tecnico';
  const f = React.useMemo(() => fitBox(text, W - 30, ZONE.capH, {max: 74, min: 46, lh: 1.16, upper: false, font: T.body, weight: 800}), [text]);
  const p = typeof on === 'number' ? 1 : useIn(4, {damping: 11, stiffness: 170, mass: 0.6});
  const all = f.lines.flatMap((l) => l.split(' '));
  const at = typeof on === 'number' ? Math.min(on, all.length - 1) : on ? all.findIndex((w) => clean(w) === clean(on)) : -1;
  const acc = KINDS[kind].accent;
  let k = -1;
  return (
    <div style={{position: 'absolute', top: ZONE.cap, left: T.safeX, width: W, height: ZONE.capH, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
      {f.lines.map((line, i) => (
        <div key={i} style={{fontFamily: T.body, fontWeight: 800, fontSize: f.size, lineHeight: 1.16, whiteSpace: 'nowrap'}}>
          {line.split(' ').map((w, j, arr) => {
            k++;
            const said = at < 0 || k < at;
            const cur = k === at;
            const color = dark ? (said || cur ? T.white : 'rgba(255,255,255,0.45)') : said || cur ? INK : 'rgba(17,17,17,0.42)';
            return (
              <React.Fragment key={j}>
                {cur ? (
                  <span style={{position: 'relative', display: 'inline-block', color: dark ? INK : INK}}>
                    <span style={{position: 'absolute', inset: '2px -12px', borderRadius: 14, background: dark ? acc : 'rgba(255,255,255,0.92)', border: `5px solid ${dark ? T.white : acc}`, transform: `scale(${interpolate(p, [0, 1], [1.35, 1])})`, opacity: p}} />
                    {!dark && <span style={{position: 'absolute', left: -20, top: -5, width: 16, height: 16, borderRadius: 8, background: acc, opacity: p}} />}
                    {!dark && <span style={{position: 'absolute', right: -20, bottom: -5, width: 16, height: 16, borderRadius: 8, background: acc, opacity: p}} />}
                    <span style={{position: 'relative'}}>{w}</span>
                  </span>
                ) : (
                  <span style={{color}}>{w}</span>
                )}
                {j < arr.length - 1 ? ' ' : ''}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const Sign: React.FC<{kind: Kind}> = ({kind}) => (
  <div style={{position: 'absolute', top: ZONE.sign, left: 0, width: T.width, textAlign: 'center', fontFamily: T.body, fontWeight: 800, fontSize: 30, letterSpacing: 2, color: kind === 'tecnico' ? 'rgba(255,255,255,0.8)' : 'rgba(17,17,17,0.7)'}}>{T.handle}</div>
);

/** Marco completo de una escena: fondo + cabecera + frase narrada + firma. El objeto central va como hijo. */
export const Frame: React.FC<{kind: Kind; cap?: string; on?: string | number; children: React.ReactNode}> = ({kind, cap, on, children}) => (
  <AbsoluteFill>
    <Bg kind={kind} />
    <Brand kind={kind} />
    {cap && <Caption text={cap} on={on} kind={kind} />}
    {children}
    <Sign kind={kind} />
  </AbsoluteFill>
);

/* ---------- animación de entrada genérica ---------- */
export const Pop: React.FC<{d?: number; children: React.ReactNode; style?: React.CSSProperties; from?: 'up' | 'scale' | 'left'}> = ({d = 0, children, style, from = 'up'}) => {
  const p = useIn(d, {damping: 12, stiffness: 150, mass: 0.7});
  const tr = from === 'scale' ? `scale(${p})` : from === 'left' ? `translateX(${interpolate(p, [0, 1], [-120, 0])}px)` : `translateY(${interpolate(p, [0, 1], [90, 0])}px) scale(${interpolate(p, [0, 1], [0.92, 1])})`;
  return <div style={{opacity: interpolate(p, [0, 0.35], [0, 1], {extrapolateRight: 'clamp'}), transform: tr, ...style}}>{children}</div>;
};

export const box = (bg: string = T.white, r = 28, sh = 12): React.CSSProperties => ({background: bg, border: `7px solid ${INK}`, borderRadius: r, boxShadow: `${sh}px ${sh}px 0 ${INK}`});

/* ---------- portapapeles (objeto central de noticias y fuentes) ---------- */
/** Alto de fila para que `n` filas quepan SIEMPRE dentro del papel (nunca se corta la última). */
export const rowHeight = (n: number) => Math.min(190, Math.floor(700 / Math.max(1, n)));

export const Clipboard: React.FC<{title: string; children: React.ReactNode; h?: number; rowH?: number}> = ({title, children, h = ZONE.objH, rowH = 190}) => {
  const p = useIn(2, {damping: 14, stiffness: 120, mass: 0.9});
  const size = fitOneLine(title, W - 170, 62, 40, T.display, '', false);
  return (
    <div style={{position: 'absolute', top: ZONE.obj + 26, left: T.safeX, width: W, height: h - 26, transform: `translateY(${interpolate(p, [0, 1], [260, 0])}px) rotate(${interpolate(p, [0, 1], [3, 0])}deg)`, opacity: interpolate(p, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'})}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 40, background: 'repeating-linear-gradient(92deg, #c98f52 0 46px, #c1864a 46px 92px)', border: `7px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`}} />
      <div style={{position: 'absolute', inset: '44px 34px 34px', borderRadius: 14, backgroundColor: '#fffdf6', backgroundImage: 'linear-gradient(#fffdf6 50%, #f1ecdc 50%)', backgroundSize: `100% ${rowH}px`, backgroundPosition: '0 190px', border: `5px solid ${INK}`, overflow: 'hidden'}}>
        <div style={{padding: '74px 38px 0'}}>
          <div style={{fontFamily: T.display, fontSize: size, color: INK, lineHeight: 1, height: 116}}>{title}</div>
          {children}
        </div>
      </div>
      <div style={{position: 'absolute', left: W / 2 - 180, top: -34, width: 360, height: 120, borderRadius: 26, background: 'linear-gradient(#eef1f5, #a9b1bd)', border: `7px solid ${INK}`}}>
        <div style={{position: 'absolute', left: 150, top: 24, width: 60, height: 28, borderRadius: 14, background: INK}} />
      </div>
    </div>
  );
};

/* ---------- iconos planos (dibujados, sin imágenes) ---------- */
const S = {stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
export const ICON: Record<string, React.ReactNode> = {
  flag: (
    <>
      <line x1="22" y1="14" x2="22" y2="88" {...S} strokeWidth={8} />
      <path d="M26 18 H84 V60 H26 Z" fill="#fff" {...S} />
      {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => ((c + r) % 2 === 0 ? <rect key={`${c}${r}`} x={26 + c * 14.5} y={18 + r * 14} width="14.5" height="14" fill={INK} /> : null)))}
    </>
  ),
  stopwatch: (
    <>
      <rect x="42" y="6" width="16" height="14" rx="3" fill={INK} />
      <circle cx="50" cy="56" r="34" fill="#fff" {...S} />
      <path d="M50 56 L50 22 A34 34 0 0 1 82 66 Z" fill="#ffd21f" />
      <path d="M50 56 L38 36" {...S} />
      <circle cx="50" cy="56" r="34" fill="none" {...S} />
    </>
  ),
  trophy: (
    <>
      <path d="M28 22 H14 C14 42 24 50 36 52" fill="none" {...S} />
      <path d="M72 22 H86 C86 42 76 50 64 52" fill="none" {...S} />
      <path d="M28 12 H72 V44 C72 60 62 68 50 68 C38 68 28 60 28 44 Z" fill="#ffd21f" {...S} />
      <rect x="44" y="68" width="12" height="12" fill="#c98a2b" {...S} />
      <rect x="30" y="80" width="40" height="10" rx="3" fill="#8a5a2b" {...S} />
    </>
  ),
  doc: (
    <>
      <rect x="20" y="8" width="60" height="84" rx="8" fill="#fff" {...S} />
      <rect x="30" y="24" width="40" height="6" rx="3" fill="#cfc9b8" />
      <rect x="30" y="38" width="40" height="6" rx="3" fill="#cfc9b8" />
      <path d="M30 66 C38 52 42 78 50 64 C56 54 60 72 70 60" fill="none" stroke="#ff4f9a" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  wrench: (
    <>
      {Array.from({length: 8}).map((_, i) => <rect key={i} x="43" y="6" width="14" height="20" rx="3" fill="#9aa0a6" {...S} strokeWidth={5} transform={`rotate(${i * 45} 50 50)`} />)}
      <circle cx="50" cy="50" r="30" fill="#b9bec4" {...S} />
      <circle cx="50" cy="50" r="12" fill="#fff" {...S} />
    </>
  ),
  chart: (
    <>
      <rect x="10" y="10" width="80" height="80" rx="12" fill="#fff" {...S} />
      <rect x="24" y="52" width="13" height="26" fill="#7cc0ff" {...S} strokeWidth={4} />
      <rect x="44" y="38" width="13" height="40" fill="#ffd21f" {...S} strokeWidth={4} />
      <rect x="64" y="22" width="13" height="56" fill="#ff4f9a" {...S} strokeWidth={4} />
    </>
  ),
  money: (
    <>
      <rect x="8" y="26" width="84" height="50" rx="10" fill="#8fe7c2" {...S} />
      <circle cx="50" cy="51" r="14" fill="#fff" {...S} />
      <path d="M50 43 V59" {...S} strokeWidth={5} />
    </>
  ),
  calendar: (
    <>
      <rect x="12" y="18" width="76" height="70" rx="10" fill="#fff" {...S} />
      <path d="M12 38 H88" {...S} />
      <rect x="12" y="18" width="76" height="20" rx="10" fill="#ff3b1d" {...S} />
      <path d="M30 10 V26 M70 10 V26" {...S} strokeWidth={8} />
      <path d="M34 62 L46 74 L68 50" fill="none" {...S} strokeWidth={8} />
    </>
  ),
  eye: (
    <>
      <path d="M6 50 C22 22 78 22 94 50 C78 78 22 78 6 50 Z" fill="#fff" {...S} />
      <circle cx="50" cy="50" r="15" fill={INK} />
      <circle cx="56" cy="44" r="5" fill="#fff" />
    </>
  ),
};

export const IconTile: React.FC<{name: string; size?: number; bg?: string}> = ({name, size = 112, bg = '#fff'}) => (
  <div style={{width: size, height: size, flex: 'none', borderRadius: size * 0.2, background: bg, border: `5px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <svg width={size * 0.78} height={size * 0.78} viewBox="0 0 100 100">{ICON[name] ?? ICON.flag}</svg>
  </div>
);

/** Fila de lista: casilla que se marca + icono + título + subtítulo. Los textos se ajustan solos al hueco. */
export const Row: React.FC<{d: number; icon: string; title: string; sub?: string; check?: boolean; badge?: string; tileBg?: string; h?: number}> = ({d, icon, title, sub, check = true, badge, tileBg, h = 190}) => {
  const tw = W - 68 - 76 - 76 - 24 - 112 - 26 - (badge ? 170 : 0);
  const ft = React.useMemo(() => fitBox(title, tw, sub ? 100 : 130, {max: 46, min: 30, upper: false, lh: 1.06}), [title, tw, sub]);
  const fs = sub ? fitOneLine(sub, tw, 31, 22, T.body, 600, false) : 0;
  const c = useIn(d + 16, {damping: 9, stiffness: 200, mass: 0.5});
  return (
    <Pop d={d} from="left" style={{height: h, display: 'flex', alignItems: 'center', gap: 24}}>
      <div style={{width: 76, height: 76, flex: 'none', borderRadius: 18, border: `6px solid ${INK}`, background: check ? interpolate(c, [0, 1], [0, 1]) > 0.5 ? '#1fa95b' : '#fff' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {check && (
          <svg width="52" height="52" viewBox="0 0 52 52" style={{transform: `scale(${c})`}}>
            <path d="M9 27 L21 39 L43 13" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <IconTile name={icon} bg={tileBg} />
      <div style={{flex: 1, minWidth: 0, marginLeft: 2}}>
        {ft.lines.map((l, i) => <div key={i} style={{fontFamily: T.display, fontSize: ft.size, lineHeight: 1.06, color: INK, whiteSpace: 'nowrap'}}>{l}</div>)}
        {sub && <div style={{fontFamily: T.body, fontWeight: 600, fontSize: fs, color: '#6b6252', marginTop: 6, whiteSpace: 'nowrap'}}>{sub}</div>}
      </div>
      {badge && <div style={{flex: 'none', fontFamily: T.body, fontWeight: 800, fontSize: 24, letterSpacing: 1, background: '#2b6cff', color: '#fff', borderRadius: 10, border: `4px solid ${INK}`, padding: '4px 12px', transform: 'rotate(4deg)'}}>{badge}</div>}
    </Pop>
  );
};

/** Casco genérico de la cuenta, pintado del color que se le pase (no es el casco de ningún piloto real). */
export const Helmet: React.FC<{color: string; size?: number; stripe?: string}> = ({color, size = 180, stripe = '#fff'}) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    <path d="M26 112 C26 52 66 22 112 22 C158 22 182 62 182 112 L182 148 C182 160 172 168 160 168 L52 168 C36 168 26 156 26 140 Z" fill={color} stroke={INK} strokeWidth="9" strokeLinejoin="round" />
    <path d="M74 24 C92 22 104 22 118 24 L118 170 L84 170 Z" fill={stripe} stroke={INK} strokeWidth="7" />
    <path d="M92 86 C92 74 102 68 116 68 L172 68 C180 68 184 74 184 82 L184 112 C184 124 176 130 166 130 L112 130 C100 130 92 122 92 110 Z" fill={INK} />
    <path d="M100 78 L152 78" stroke="rgba(255,255,255,0.4)" strokeWidth="7" strokeLinecap="round" />
  </svg>
);
