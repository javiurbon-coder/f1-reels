import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import './fonts';
import {Card, Mascot, useBob, useIn} from './kit';
import {theme as T} from './theme';
import {fitBox, fitOneLine} from './fit';
import type {Scene} from './sceneTypes';

/* Zonas (px) de un reel 1080×1920 para que nada se pise:
   cabecera 110-230 · título 250-… · gráfica 560-1260 · subtítulos 1300-1560 (Instagram tapa >1590). */
const W = T.width - T.safeX * 2; // 952
const TITLE_TOP = 250;
const VISUAL_TOP = 560;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\d]/gu, '').toLowerCase();

const PALETTES: [string, string][] = [[T.mint, T.mint2], [T.sky, T.sky2], ['#ffd21f', '#ffe680'], ['#ff9ec7', '#ffc9e0']];

/* ---------- fondo rayado en movimiento ---------- */
const Stripes: React.FC<{idx: number}> = ({idx}) => {
  const frame = useCurrentFrame();
  const [a, b] = PALETTES[idx % PALETTES.length];
  const t = (frame * 1.4) % 160;
  return (
    <AbsoluteFill style={{background: a, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute', left: -1200, top: -1200, width: 4400, height: 4400,
          transform: `translate(${t * 0.7071}px, ${t * 0.7071}px)`,
          backgroundImage: `repeating-linear-gradient(135deg, ${a} 0 80px, ${b} 80px 160px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const MiniHeader: React.FC = () => {
  const p = useIn(0);
  return (
    <div style={{position: 'absolute', top: 112, left: T.safeX, right: T.safeX, display: 'flex', alignItems: 'center', gap: 16, opacity: p}}>
      <Mascot size={92} />
      <div style={{fontFamily: T.display, fontSize: 40, color: T.ink, lineHeight: 1}}>{T.brand}</div>
    </div>
  );
};

export const SceneFrame: React.FC<{idx: number; children: React.ReactNode}> = ({idx, children}) => (
  <AbsoluteFill>
    <Stripes idx={idx} />
    <MiniHeader />
    {children}
  </AbsoluteFill>
);

/* ---------- título con palabra resaltada (recuadro rosa) ---------- */
const HlBox: React.FC<{children: React.ReactNode; delay: number}> = ({children, delay}) => {
  const p = useIn(delay, {damping: 12, stiffness: 160, mass: 0.7});
  const dot: React.CSSProperties = {position: 'absolute', width: 18, height: 18, borderRadius: 9, background: T.pink, border: `3px solid ${T.white}`};
  return (
    <span style={{position: 'relative', display: 'inline-block', margin: '0 -12px', padding: '0 12px', color: T.ink}}>
      <span style={{position: 'absolute', inset: '4% 0', border: `6px solid ${T.pink}`, borderRadius: 14, background: 'rgba(255,255,255,0.55)', opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.4, 1])})`}} />
      <span style={{...dot, left: -6, top: '2%', opacity: p}} />
      <span style={{...dot, right: -6, bottom: '2%', opacity: p}} />
      <span style={{position: 'relative'}}>{children}</span>
    </span>
  );
};

export const Title: React.FC<{text: string; hl?: string[]; h?: number; max?: number; top?: number}> = ({text, hl = [], h = 220, max = 86, top = TITLE_TOP}) => {
  const f = React.useMemo(() => fitBox(text, W - 40, h, {max, min: 44}), [text, h, max]);
  const p = useIn(2);
  const want = new Set(hl.map(norm));
  return (
    <div style={{position: 'absolute', top, left: T.safeX, width: W, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: p, transform: `translateY(${interpolate(p, [0, 1], [-50, 0])}px)`}}>
      {f.lines.map((line, i) => (
        <div key={i} style={{fontFamily: T.display, fontSize: f.size, lineHeight: 1.08, whiteSpace: 'nowrap', color: T.ink, textAlign: 'center'}}>
          {line.split(' ').map((w, j, a) => (
            <React.Fragment key={j}>
              {want.has(norm(w)) ? <HlBox delay={14 + i * 3}>{w}</HlBox> : w}
              {j < a.length - 1 ? ' ' : ''}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
};

/* ---------- iconos animados (dibujados con formas, sin imágenes) ---------- */
const S = {stroke: T.ink, strokeWidth: 9, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};

const Trophy: React.FC = () => {
  const f = useCurrentFrame();
  const star = 1 + Math.sin(f * 0.16) * 0.08;
  return (
    <svg width="440" height="440" viewBox="0 0 440 440">
      <path d="M120 100 H70 C70 175 105 205 150 212" fill="none" {...S} />
      <path d="M320 100 H370 C370 175 335 205 290 212" fill="none" {...S} />
      <path d="M120 60 H320 V190 C320 255 280 296 220 296 C160 296 120 255 120 190 Z" fill={T.gold} {...S} />
      <path d="M205 296 H235 V350 H205 Z" fill="#c98a2b" {...S} />
      <rect x="140" y="350" width="160" height="42" rx="10" fill="#8a5a2b" {...S} />
      <g transform={`translate(220 170) scale(${star})`}>
        <path d="M0 -46 L13 -15 L46 -13 L20 8 L29 40 L0 22 L-29 40 L-20 8 L-46 -13 L-13 -15 Z" fill={T.white} {...S} strokeWidth={7} />
      </g>
    </svg>
  );
};

const Stopwatch: React.FC = () => {
  const f = useCurrentFrame();
  const ang = (f * 5) % 360;
  return (
    <svg width="440" height="440" viewBox="0 0 440 440">
      <rect x="196" y="40" width="48" height="40" rx="8" fill={T.ink} />
      <rect x="205" y="80" width="30" height="34" fill={T.ink} />
      <circle cx="220" cy="250" r="150" fill={T.white} {...S} strokeWidth={11} />
      {Array.from({length: 12}).map((_, i) => (
        <line key={i} x1="220" y1="116" x2="220" y2={i % 3 === 0 ? 138 : 128} stroke={T.ink} strokeWidth={i % 3 === 0 ? 9 : 5} strokeLinecap="round" transform={`rotate(${i * 30} 220 250)`} />
      ))}
      <path d={`M220 250 L220 120 A130 130 0 ${ang > 180 ? 1 : 0} 1 ${220 + 130 * Math.sin((ang * Math.PI) / 180)} ${250 - 130 * Math.cos((ang * Math.PI) / 180)} Z`} fill={T.red} opacity="0.85" />
      <line x1="220" y1="250" x2={220 + 118 * Math.sin((ang * Math.PI) / 180)} y2={250 - 118 * Math.cos((ang * Math.PI) / 180)} stroke={T.ink} strokeWidth="11" strokeLinecap="round" />
      <circle cx="220" cy="250" r="14" fill={T.ink} />
    </svg>
  );
};

const Doc: React.FC = () => {
  const f = useCurrentFrame();
  const draw = interpolate(f, [10, 55], [300, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const seal = useIn(50);
  return (
    <svg width="440" height="440" viewBox="0 0 440 440">
      <rect x="90" y="30" width="260" height="380" rx="22" fill={T.white} {...S} />
      {[90, 130, 170].map((y, i) => <rect key={y} x="125" y={y} width={i === 2 ? 110 : 190} height="16" rx="8" fill="#d6d1c4" />)}
      <path d="M125 270 C150 220 165 330 190 270 C205 235 215 320 240 275 C258 245 268 300 300 262" fill="none" stroke={T.pink} strokeWidth="10" strokeLinecap="round" strokeDasharray="300" strokeDashoffset={draw} />
      <g transform={`translate(285 345) scale(${seal})`}>
        <circle r="46" fill={T.gold} {...S} strokeWidth={8} />
        <path d="M-20 2 L-6 16 L22 -14" fill="none" stroke={T.ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

const Gear: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <svg width="440" height="440" viewBox="0 0 440 440">
      <g transform={`rotate(${f * 1.6} 220 220)`}>
        {Array.from({length: 10}).map((_, i) => (
          <rect key={i} x="196" y="38" width="48" height="70" rx="8" fill="#9aa0a6" {...S} strokeWidth={8} transform={`rotate(${i * 36} 220 220)`} />
        ))}
        <circle cx="220" cy="220" r="140" fill="#b9bec4" {...S} />
        <circle cx="220" cy="220" r="58" fill={T.cream} {...S} />
      </g>
    </svg>
  );
};

const Flag: React.FC = () => {
  const f = useCurrentFrame();
  const cols = 8, rows = 6, sz = 44;
  return (
    <svg width="440" height="440" viewBox="0 0 440 440">
      <line x1="64" y1="40" x2="64" y2="410" stroke={T.ink} strokeWidth="14" strokeLinecap="round" />
      <g transform="translate(76 70)">
        {Array.from({length: cols * rows}).map((_, k) => {
          const c = k % cols, r = Math.floor(k / cols);
          const wave = Math.sin(f * 0.22 + c * 0.7) * (6 + c * 1.6);
          return <rect key={k} x={c * sz} y={r * sz + wave} width={sz + 1} height={sz + 1} fill={(c + r) % 2 ? T.white : T.ink} />;
        })}
      </g>
    </svg>
  );
};

const ICONS = {trophy: Trophy, stopwatch: Stopwatch, doc: Doc, wrench: Gear, flag: Flag};

const IconBadge: React.FC<{icon: keyof typeof ICONS}> = ({icon}) => {
  const p = useIn(10, {damping: 9, stiffness: 140, mass: 0.7});
  const bob = useBob(10, 0.09);
  const Icon = ICONS[icon] ?? Flag;
  return (
    <div style={{position: 'absolute', top: 700, left: (T.width - 500) / 2, width: 500, height: 500, borderRadius: 250, background: T.white, border: `${T.border}px solid ${T.ink}`, boxShadow: `${T.shadow}px ${T.shadow}px 0 ${T.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translateY(${bob}px) scale(${p}) rotate(${interpolate(p, [0, 1], [-14, 0])}deg)`}}>
      <Icon />
    </div>
  );
};

/* ---------- ESCENAS ---------- */

export const PointScene: React.FC<{idx: number; text: string; hl?: string[]; icon?: keyof typeof ICONS}> = ({idx, text, hl, icon = 'flag'}) => (
  <SceneFrame idx={idx}>
    <Title text={text} hl={hl} h={420} max={84} />
    <IconBadge icon={icon} />
  </SceneFrame>
);

/** Número grande que cuenta hasta su valor, sobre un sol giratorio. */
export const StatScene: React.FC<{idx: number; value: number; label: string; title: string}> = ({idx, value, label, title}) => {
  const f = useCurrentFrame();
  const shown = Math.round(interpolate(f, [8, 50], [0, Math.abs(value)], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const sign = /posici/i.test(label) ? (value >= 0 ? '+' : '−') : '';
  const txt = `${sign}${shown}`;
  const size = fitOneLine(`${sign}${Math.abs(value)}`, 760, 460, 120);
  const p = useIn(6, {damping: 10, stiffness: 130, mass: 0.8});
  const lab = React.useMemo(() => fitBox(label, W - 80, 150, {max: 56, min: 36}), [label]);
  return (
    <SceneFrame idx={idx}>
      <Title text={title} h={200} max={78} />
      <div style={{position: 'absolute', left: 90, top: 520, width: 900, height: 900, borderRadius: 450, opacity: 0.55, transform: `rotate(${f * 0.5}deg) scale(${p})`, background: `repeating-conic-gradient(${T.white} 0deg 9deg, transparent 9deg 18deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 35%, transparent 70%)', maskImage: 'radial-gradient(circle, #000 35%, transparent 70%)'}} />
      <div style={{position: 'absolute', top: 620, left: 0, width: T.width, textAlign: 'center', fontFamily: T.display, fontSize: size, lineHeight: 1, color: T.ink, transform: `scale(${interpolate(p, [0, 1], [0.5, 1])})`, textShadow: `${size * 0.03}px ${size * 0.03}px 0 ${T.white}`}}>
        {txt}
      </div>
      <div style={{position: 'absolute', left: T.safeX + 20, width: W - 40, top: 620 + size + 20, display: 'flex', justifyContent: 'center'}}>
        <Card delay={22} rotate={-1.5} bg={T.ink} style={{padding: '18px 34px', borderRadius: 22}}>
          {lab.lines.map((l, i) => <div key={i} style={{fontFamily: T.display, fontSize: lab.size, lineHeight: 1.08, color: T.yellow, textAlign: 'center', whiteSpace: 'nowrap'}}>{l}</div>)}
        </Card>
      </div>
    </SceneFrame>
  );
};

/** Parrilla → meta: cada piloto es una línea; el punto relleno viaja desde su posición de salida hasta la de llegada. */
export const BarsScene: React.FC<{idx: number; title: string; hl?: string; rows: {name: string; grid: number; finish: number; color: string; me?: boolean}[]}> = ({idx, title, hl, rows}) => {
  const f = useCurrentFrame();
  const maxPos = Math.max(10, ...rows.flatMap((r) => [r.grid, r.finish])) > 10 ? 20 : 10;
  const rowH = Math.min(104, 560 / rows.length);
  const x0 = 250, trackW = 560, cw = W - 56;
  const xOf = (pos: number) => x0 + ((pos - 1) / (maxPos - 1)) * trackW;
  const ticks = maxPos === 20 ? [1, 5, 10, 15, 20] : [1, 5, 10];
  const h = rows.length * rowH + 80;
  return (
    <SceneFrame idx={idx}>
      <Title text={title} hl={hl ? [hl] : []} h={200} max={78} />
      <Card delay={4} rotate={0} style={{position: 'absolute', top: VISUAL_TOP, left: T.safeX, width: W, padding: 28, borderRadius: 28}}>
        <svg width={cw} height={h} viewBox={`0 0 ${cw} ${h}`} style={{display: 'block'}}>
          {rows.map((r, i) => {
            const p = useIn(12 + i * 8, {damping: 16, stiffness: 90, mass: 1});
            const cy = i * rowH + rowH / 2;
            const gx = xOf(r.grid), fx = gx + (xOf(r.finish) - gx) * p;
            const gain = r.grid - r.finish;
            const col = gain > 0 ? T.green : gain < 0 ? T.red : T.muted;
            const nameSize = fitOneLine(r.name, 200, 38, 22);
            return (
              <g key={r.name}>
                {r.me && <rect x="-12" y={cy - rowH / 2 + 4} width={cw + 24} height={rowH - 8} rx="16" fill={T.yellow} opacity="0.85" />}
                <text x="0" y={cy + nameSize * 0.36} fontFamily={T.display} fontSize={nameSize} fill={T.ink}>{r.name.toUpperCase()}</text>
                <line x1={x0} y1={cy} x2={x0 + trackW} y2={cy} stroke="#d6d1c4" strokeWidth="6" strokeLinecap="round" />
                <line x1={gx} y1={cy} x2={fx} y2={cy} stroke={r.color} strokeWidth="14" strokeLinecap="round" />
                <circle cx={gx} cy={cy} r="15" fill={T.white} stroke={T.ink} strokeWidth="5" />
                <circle cx={fx} cy={cy} r="26" fill={r.color} stroke={T.ink} strokeWidth="6" />
                <text x={fx} y={cy + 9} textAnchor="middle" fontFamily={T.display} fontSize="26" fill={T.ink}>{Math.round(interpolate(p, [0, 1], [r.grid, r.finish]))}</text>
                <text x={cw} y={cy + 16} textAnchor="end" fontFamily={T.display} fontSize="48" fill={col} opacity={interpolate(p, [0.6, 1], [0, 1], {extrapolateLeft: 'clamp'})}>{gain > 0 ? `+${gain}` : gain < 0 ? `${gain}` : '='}</text>
              </g>
            );
          })}
          {ticks.map((t) => (
            <text key={t} x={xOf(t)} y={rows.length * rowH + 34} textAnchor="middle" fontFamily={T.mono} fontWeight="700" fontSize="26" fill={T.muted}>{t}º</text>
          ))}
          <g opacity={interpolate(f, [30, 44], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}>
            <circle cx={x0} cy={rows.length * rowH + 66} r="9" fill={T.white} stroke={T.ink} strokeWidth="4" />
            <text x={x0 + 20} y={rows.length * rowH + 74} fontFamily={T.mono} fontWeight="700" fontSize="24" fill={T.ink}>PARRILLA</text>
            <circle cx={x0 + 230} cy={rows.length * rowH + 66} r="11" fill={T.ink} />
            <text x={x0 + 252} y={rows.length * rowH + 74} fontFamily={T.mono} fontWeight="700" fontSize="24" fill={T.ink}>META</text>
          </g>
        </svg>
      </Card>
    </SceneFrame>
  );
};

/** Ranking: barras horizontales que crecen (campeonato). */
export const RankScene: React.FC<{idx: number; title: string; unit: string; rows: {name: string; value: number; color: string; me?: boolean}[]}> = ({idx, title, unit, rows}) => {
  const max = Math.max(...rows.map((r) => r.value));
  const rowH = Math.min(112, 560 / rows.length);
  const x0 = 240, barW = 470, cw = W - 56;
  const h = rows.length * rowH;
  return (
    <SceneFrame idx={idx}>
      <Title text={title} h={200} max={78} />
      <Card delay={4} style={{position: 'absolute', top: VISUAL_TOP, left: T.safeX, width: W, padding: 28, paddingBottom: 44, borderRadius: 28}}>
        <svg width={cw} height={h} viewBox={`0 0 ${cw} ${h}`} style={{display: 'block'}}>
          {rows.map((r, i) => {
            const p = useIn(10 + i * 7, {damping: 18, stiffness: 80, mass: 1});
            const cy = i * rowH + rowH / 2;
            const nameSize = fitOneLine(r.name, 210, 38, 22);
            const bw = Math.max(6, (r.value / max) * barW * p);
            return (
              <g key={r.name}>
                {r.me && <rect x="-12" y={cy - rowH / 2 + 4} width={cw + 24} height={rowH - 8} rx="16" fill={T.yellow} opacity="0.85" />}
                <text x="0" y={cy + nameSize * 0.36} fontFamily={T.display} fontSize={nameSize} fill={T.ink}>{r.name.toUpperCase()}</text>
                <rect x={x0} y={cy - 27} width={bw} height="54" rx="12" fill={r.color} stroke={T.ink} strokeWidth="6" />
                <text x={x0 + bw + 14} y={cy + 15} fontFamily={T.display} fontSize="42" fill={T.ink} opacity={p}>{Math.round(r.value * p)}</text>
              </g>
            );
          })}
        </svg>
        <div style={{position: 'absolute', right: 30, bottom: 6, fontFamily: T.mono, fontWeight: 700, fontSize: 24, color: T.muted}}>{unit.toUpperCase()}</div>
      </Card>
    </SceneFrame>
  );
};

/** Racha de resultados: medallas con la posición final de cada carrera. */
export const StreakScene: React.FC<{idx: number; title: string; items: {label: string; pos: number; dnf: boolean}[]}> = ({idx, title, items}) => {
  const n = items.length;
  const cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const gap = 28;
  const d = Math.min(200, Math.floor((W - (cols - 1) * gap) / cols) - 10, Math.floor(540 / rows) - 80);
  const cellW = (W - (cols - 1) * gap) / cols;
  const podiums = items.filter((x) => !x.dnf && x.pos <= 3).length;
  const color = (x: {pos: number; dnf: boolean}) => (x.dnf ? T.red : x.pos === 1 ? T.gold : x.pos === 2 ? T.silver : x.pos === 3 ? T.bronze : T.white);
  const sp = useIn(8 + n * 7 + 6, {damping: 9, stiffness: 190, mass: 0.6});
  return (
    <SceneFrame idx={idx}>
      <Title text={title} h={200} max={78} />
      <div style={{position: 'absolute', top: VISUAL_TOP, left: T.safeX, width: W}}>
        {Array.from({length: rows}).map((_, r) => (
          <div key={r} style={{display: 'flex', justifyContent: 'center', gap, marginBottom: 22}}>
            {items.slice(r * cols, r * cols + cols).map((x, c) => <Medal key={c} x={x} d={d} w={cellW} delay={8 + (r * cols + c) * 7} bg={color(x)} />)}
          </div>
        ))}
        <div style={{display: 'flex', justifyContent: 'center', marginTop: 14, transform: `scale(${sp})`}}>
          <div style={{fontFamily: T.display, fontSize: 52, background: T.ink, color: T.yellow, border: `${T.border - 2}px solid ${T.ink}`, borderRadius: 18, padding: '8px 30px', boxShadow: `8px 8px 0 ${T.white}`}}>
            {podiums} {podiums === 1 ? 'PODIO' : 'PODIOS'}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};

const Medal: React.FC<{x: {label: string; pos: number; dnf: boolean}; d: number; w: number; delay: number; bg: string}> = ({x, d, w, delay, bg}) => {
  const p = useIn(delay, {damping: 9, stiffness: 190, mass: 0.6});
  const bob = useBob(4, 0.12, delay);
  return (
    <div style={{width: w, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${bob}px) scale(${p})`}}>
      <div style={{width: d, height: d, borderRadius: d / 2, background: bg, border: `${T.border + 1}px solid ${T.ink}`, boxShadow: `8px 8px 0 ${T.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontSize: d * 0.4, color: x.dnf ? T.white : T.ink}}>
        {x.dnf ? 'RET' : `P${x.pos}`}
      </div>
      <div style={{marginTop: 12, fontFamily: T.mono, fontWeight: 700, fontSize: 30, background: T.white, border: `4px solid ${T.ink}`, borderRadius: 12, padding: '0 12px'}}>{x.label}</div>
    </div>
  );
};

/** Escena de la historia según su tipo. `hook` y `sources` los dibuja NoticiaVerificada (ya existían). */
export const renderScene = (s: Scene, idx: number): React.ReactNode => {
  switch (s.type) {
    case 'point': return <PointScene idx={idx} text={s.text} hl={s.hl} icon={s.icon} />;
    case 'stat': return <StatScene idx={idx} value={s.value} label={s.label} title={s.title} />;
    case 'bars': return <BarsScene idx={idx} title={s.title} hl={s.hl} rows={s.rows} />;
    case 'rank': return <RankScene idx={idx} title={s.title} unit={s.unit} rows={s.rows} />;
    case 'streak': return <StreakScene idx={idx} title={s.title} items={s.items} />;
    default: return null;
  }
};
