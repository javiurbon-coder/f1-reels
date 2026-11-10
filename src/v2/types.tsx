// SISTEMA DE DISEÑO v2 — una escena-objeto por cada tipo de reel.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, Sequence} from 'remotion';
import {Mascot, useBob, useIn} from '../kit';
import {theme as T} from '../theme';
import {fitBox, fitOneLine} from '../fit';
import {Bg, Brand, Clipboard, Frame, Helmet, IconTile, INK, KINDS, Pop, Row, Sign, W, ZONE, box, rowHeight} from './ui';

const X = T.safeX;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

/* ============ 0 · PORTADA (primer segundo: el gancho) ============ */
type PortadaProps = {kind?: keyof typeof KINDS; headline: string; hl?: string; chip: string; date: string};
const PortadaBase: React.FC<PortadaProps> = ({kind = 'noticia', headline, hl, chip, date}) => {
  const f = React.useMemo(() => fitBox(headline, W, 700, {max: 150, min: 76, lh: 1.12}), [headline]);
  const bob = useBob(10, 0.09);
  const m = useIn(18, {damping: 9, stiffness: 120, mass: 0.8});
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Bg kind={kind} />
      <Brand kind={kind} />
      <div style={{position: 'absolute', top: 250, left: X, display: 'flex', gap: 18, alignItems: 'center'}}>
        <Pop d={4} from="scale"><div style={{...box('#fff', 18, 8), fontFamily: T.display, fontSize: 36, padding: '8px 22px', transform: 'rotate(-3deg)'}}>{chip}</div></Pop>
        <Pop d={8}><div style={{fontFamily: T.body, fontWeight: 800, fontSize: 34, letterSpacing: 2, color: INK}}>{date}</div></Pop>
      </div>
      <div style={{position: 'absolute', top: 370, left: X, width: W, isolation: 'isolate'}}>
        {f.lines.map((line, i) => {
          const p = interpolate(frame, [8 + i * 5, 20 + i * 5], [0, 1], clamp);
          return (
            <div key={i} style={{fontFamily: T.display, fontSize: f.size, lineHeight: 1.12, whiteSpace: 'nowrap', color: INK, opacity: p, position: 'relative', zIndex: 10 - i, transform: `translateY(${(1 - p) * 70}px)`}}>
              {line.split(' ').map((w, j, a) => (
                <React.Fragment key={j}>
                  {hl && w.replace(/[^\p{L}\d]/gu, '').toUpperCase() === hl.toUpperCase() ? <span style={{background: '#fff', padding: '0 14px', marginLeft: -14, border: `7px solid ${INK}`, borderRadius: 18, boxShadow: `9px 9px 0 ${INK}`, lineHeight: 1}}>{w}</span> : w}
                  {j < a.length - 1 ? ' ' : ''}
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', right: 40, top: 1120, transform: `translateY(${bob}px) rotate(${interpolate(m, [0, 1], [24, -8])}deg) scale(${m})`}}><Mascot size={420} mood="wow" /></div>
      <div style={{position: 'absolute', left: X, top: 1330, transform: 'rotate(-4deg)'}}>
        <Pop d={30} from="scale"><div style={{...box(INK, 22, 0), color: '#ffd21f', fontFamily: T.display, fontSize: 46, padding: '14px 28px', boxShadow: `10px 10px 0 #fff`}}>TE LO CUENTO ↓</div></Pop>
      </div>
      <Sign kind={kind} />
    </AbsoluteFill>
  );
};

/** PORTADA: el fotograma 0 ya es la portada completa (título, chip, mascota y botón visibles).
 *  Instagram usa el primer fotograma como portada por defecto, así que no puede arrancar en blanco.
 *  Se adelanta la animación 40 fotogramas (Sequence con `from` negativo): lo que antes «entraba» ya está colocado en el 0. */
export const Portada: React.FC<PortadaProps> = (p) => <Sequence from={-40} layout="none"><PortadaBase {...p} /></Sequence>;

/* ============ 1 · NOTICIA VERIFICADA: portapapeles "Lo que sabemos" ============ */
export const Noticia: React.FC<{cap: string; on?: string | number; title?: string; kind?: keyof typeof KINDS; rows: {icon: string; title: string; sub?: string; d?: number}[]}> = ({cap, on, title = 'Lo que sabemos', rows, kind = 'noticia'}) => (
  <Frame kind={kind} cap={cap} on={on}>
    <Clipboard title={title} rowH={rowHeight(Math.min(4, rows.length))}>
      {rows.slice(0, 4).map((r, i) => <Row key={i} h={rowHeight(Math.min(4, rows.length))} d={r.d ?? 12 + i * 14} icon={r.icon} title={r.title} sub={r.sub} />)}
    </Clipboard>
  </Frame>
);

/* ============ 2 · EL DATO: número gigante + gráfica parrilla → meta ============ */
export const Dato: React.FC<{cap: string; on?: string | number; value: string; label: string; chartTitle?: string; maxPos?: number; rows: {name: string; grid: number; finish: number; color: string; me?: boolean; tag?: string}[]}> = ({cap, on, value, label, rows, chartTitle = 'De la parrilla a la meta', maxPos = 10}) => {
  const p = useIn(6, {damping: 9, stiffness: 140, mass: 0.8});
  const frame = useCurrentFrame();
  const cw = W - 70, x0 = 280, tw = cw - x0 - 130, rh = rows.length <= 3 ? 140 : 96;
  const vs = fitOneLine(value, 400, 300, 140);
  const xOf = (pos: number) => x0 + ((pos - 1) / (maxPos - 1)) * tw;
  const ticks = maxPos > 12 ? [1, 5, 10, 15, 20].filter((t) => t <= maxPos) : [1, 4, 7, 10];
  const lf = React.useMemo(() => fitBox(label, 450, 170, {max: 58, min: 30, upper: false, lh: 1.06}), [label]);
  return (
    <Frame kind="dato" cap={cap} on={on}>
      {/* número gigante con destello giratorio */}
      <div style={{position: 'absolute', top: ZONE.obj - 6, left: X, width: W, height: 330}}>
        <div style={{position: 'absolute', left: -20, top: -70, width: 470, height: 470, opacity: 0.7, transform: `rotate(${frame * 0.6}deg) scale(${p})`, background: 'repeating-conic-gradient(#fff 0deg 10deg, transparent 10deg 20deg)', WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 68%)', maskImage: 'radial-gradient(circle, #000 30%, transparent 68%)'}} />
        <div style={{position: 'absolute', left: 0, top: 10, width: 430, textAlign: 'center', fontFamily: T.display, fontSize: vs, lineHeight: 1, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK, textShadow: '9px 9px 0 #fff', transform: `scale(${interpolate(p, [0, 1], [0.4, 1])}) rotate(-4deg)`}}>{value}</div>
        <Pop d={20} style={{position: 'absolute', left: 430, top: 96, width: 522}}>
          <div style={{...box(INK, 22, 0), boxShadow: '10px 10px 0 #fff', color: '#ffd21f', fontFamily: T.display, fontSize: lf.size, padding: '22px 30px', lineHeight: 1.06, transform: 'rotate(2deg)'}}>{lf.lines.map((l, i) => <div key={i} style={{whiteSpace: 'nowrap'}}>{l}</div>)}</div>
        </Pop>
      </div>
      {/* tarjeta con la gráfica */}
      {rows.length > 0 && <Pop d={10} style={{position: 'absolute', top: ZONE.obj + 350, left: X, width: W}}>
        <div style={{...box('#fff', 30, 14), padding: '26px 35px 22px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8}}>
            <IconTile name="chart" size={70} />
            <div style={{fontFamily: T.display, fontSize: fitOneLine(chartTitle, cw - 100, 40, 26, T.display, '', false), color: INK}}>{chartTitle}</div>
          </div>
          <svg width={cw} height={rows.length * rh + 50} viewBox={`0 0 ${cw} ${rows.length * rh + 50}`} style={{display: 'block'}}>
            {rows.map((r, i) => {
              const a = interpolate(frame, [34 + i * 12, 78 + i * 12], [0, 1], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 3)});
              const cy = i * rh + rh / 2, gx = xOf(r.grid), fx = gx + (xOf(r.finish) - gx) * a, gain = r.grid - r.finish;
              const ns = fitOneLine(r.name, 225, 36, 22, T.display, '', false);
              return (
                <g key={r.name}>
                  {r.me && <rect x="-14" y={cy - rh / 2 + 5} width={cw + 28} height={rh - 10} rx="18" fill="#ffd21f" />}
                  <text x="0" y={cy + ns * 0.36} fontFamily={T.display} fontSize={ns} fill={INK}>{r.name}</text>
                  <line x1={x0} y1={cy} x2={x0 + tw} y2={cy} stroke={r.me ? 'rgba(17,17,17,0.25)' : '#ddd8ca'} strokeWidth="6" strokeLinecap="round" />
                  <line x1={gx} y1={cy} x2={fx} y2={cy} stroke={INK} strokeWidth="20" strokeLinecap="round" />
                  <line x1={gx} y1={cy} x2={fx} y2={cy} stroke={r.color} strokeWidth="10" strokeLinecap="round" />
                  <circle cx={gx} cy={cy} r="13" fill="#fff" stroke={INK} strokeWidth="5" />
                  <circle cx={fx} cy={cy} r="27" fill={r.color} stroke={INK} strokeWidth="6" />
                  <text x={fx} y={cy + 10} textAnchor="middle" fontFamily={T.display} fontSize="28" fill={INK}>{Math.round(r.grid + (r.finish - r.grid) * a)}</text>
                  <text x={cw} y={cy + 16} textAnchor="end" fontFamily={T.display} fontSize="46" fill={gain > 0 ? '#12843f' : gain < 0 ? '#d42a10' : '#8a8371'} opacity={interpolate(a, [0.7, 1], [0, 1], clamp)}>{r.tag ?? (gain > 0 ? `+${gain}` : gain < 0 ? gain : '=')}</text>
                </g>
              );
            })}
            {ticks.map((t) => <text key={t} x={xOf(t)} y={rows.length * rh + 36} textAnchor="middle" fontFamily={T.body} fontWeight="800" fontSize="26" fill="#8a8371">{t}º</text>)}
          </svg>
        </div>
      </Pop>}
    </Frame>
  );
};

/* ============ 3 · RESULTADO DEL GP: podio ============ */
export const Resultado: React.FC<{cap: string; on?: string | number; gp: string; podium: {name: string; team: string; color: string; gap: string}[]; fastest?: string}> = ({cap, on, gp, podium, fastest}) => {
  const order = [1, 0, 2]; // 2º · 1º · 3º
  const hs = [560, 440, 350], bw = 296, base = ZONE.obj + 905;
  const gs = fitOneLine(gp, W - 190, 46, 28, T.display, '', false);
  return (
    <Frame kind="resultado" cap={cap} on={on}>
      <Pop d={2} style={{position: 'absolute', top: ZONE.obj, left: X, width: W}}>
        <div style={{...box('#fff', 22, 10), height: 96, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', overflow: 'hidden'}}>
          <div style={{width: 110, height: 60, flex: 'none', border: `5px solid ${INK}`, backgroundImage: `repeating-conic-gradient(${INK} 0 25%, #fff 0 50%)`, backgroundSize: '30px 30px'}} />
          <div style={{fontFamily: T.display, fontSize: gs, color: INK, whiteSpace: 'nowrap'}}>{gp}</div>
        </div>
      </Pop>
      {order.map((k, col) => {
        const d = podium[k], h = hs[k], left = X + 16 + col * (bw + 16);
        const p = useIn(14 + (2 - k) * 12, {damping: 13, stiffness: 110, mass: 0.9});
        const hp = useIn(34 + (2 - k) * 12, {damping: 8, stiffness: 170, mass: 0.6});
        const bob = useBob(5, 0.1, k * 2);
        const ns = fitOneLine(d.name, bw - 40, 44, 24, T.display, '', false);
        const tsz = fitOneLine(d.team, bw - 40, 27, 18, T.body, 800, false);
        return (
          <React.Fragment key={k}>
            <div style={{position: 'absolute', left: left + bw / 2 - 105, top: base - h - 196 + bob, transform: `scale(${hp}) rotate(${k === 0 ? -6 : k === 1 ? 5 : -3}deg)`}}><Helmet color={d.color} size={210} /></div>
            <div style={{position: 'absolute', left, top: base - h * p, width: bw, height: h * p, overflow: 'hidden', ...box(k === 0 ? '#ffd21f' : k === 1 ? '#e4e8ee' : '#eda873', 20, 10), borderBottomLeftRadius: 0, borderBottomRightRadius: 0}}>
              <div style={{textAlign: 'center', fontFamily: T.display, fontSize: 150, lineHeight: 1, color: INK, marginTop: 14}}>{k + 1}</div>
              <div style={{textAlign: 'center', fontFamily: T.display, fontSize: ns, color: INK, whiteSpace: 'nowrap', marginTop: 2}}>{d.name}</div>
              <div style={{textAlign: 'center', fontFamily: T.body, fontWeight: 800, fontSize: tsz, color: 'rgba(17,17,17,0.7)', whiteSpace: 'nowrap'}}>{d.team}</div>
              {h > 300 && d.gap && <div style={{margin: '14px auto 0', width: 'fit-content', fontFamily: T.mono, fontWeight: 700, fontSize: 28, background: INK, color: '#fff', borderRadius: 10, padding: '2px 14px'}}>{d.gap}</div>}
            </div>
          </React.Fragment>
        );
      })}
      <div style={{position: 'absolute', left: X - 10, top: base - 4, width: W + 20, height: 26, background: INK, borderRadius: 8}} />
      {fastest && (
        <Pop d={60} style={{position: 'absolute', top: base + 40, left: X, width: W}}>
          <div style={{...box('#b46bff', 20, 8), height: 78, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: T.body, fontWeight: 800, fontSize: fitOneLine('VUELTA RÁPIDA · ' + fastest, W - 80, 36, 22, T.body, 800, false), color: '#fff'}}>VUELTA RÁPIDA · {fastest}</div>
        </Pop>
      )}
    </Frame>
  );
};

/* ============ 4 · MERCADO: fichajes y renovaciones ============ */
export const Mercado: React.FC<{cap: string; on?: string | number; kindLabel: string; driver: string; team: string; teamColor: string; until: string}> = ({cap, on, kindLabel, driver, team, teamColor, until}) => {
  const frame = useCurrentFrame();
  const ds = fitOneLine(driver, W - 330, 92, 44, T.display, '', false);
  const ts = fitOneLine(team, W - 330, 80, 40, T.display, '', false);
  const draw = interpolate(frame, [50, 85], [300, 0], clamp);
  const seal = useIn(84, {damping: 8, stiffness: 190, mass: 0.6});
  return (
    <Frame kind="mercado" cap={cap} on={on}>
      <div style={{position: 'absolute', top: ZONE.obj, left: X}}>
        <Pop d={4} from="scale"><div style={{...box('#ff4f9a', 18, 8), color: '#fff', fontFamily: T.display, fontSize: 44, padding: '8px 26px', transform: 'rotate(-3deg)'}}>{kindLabel}</div></Pop>
      </div>
      <Pop d={10} from="left" style={{position: 'absolute', top: ZONE.obj + 120, left: X, width: W}}>
        <div style={{...box('#fff', 30, 14), height: 250, display: 'flex', alignItems: 'center', gap: 20, padding: '0 34px'}}>
          <Helmet color={teamColor} size={210} />
          <div>
            <div style={{fontFamily: T.body, fontWeight: 800, fontSize: 30, color: '#8a8371', letterSpacing: 2}}>PILOTO</div>
            <div style={{fontFamily: T.display, fontSize: ds, lineHeight: 1, color: INK, whiteSpace: 'nowrap'}}>{driver}</div>
          </div>
        </div>
      </Pop>
      {/* flechas que bajan */}
      <svg style={{position: 'absolute', top: ZONE.obj + 388, left: T.width / 2 - 60}} width="120" height="130" viewBox="0 0 120 130">
        {[0, 1, 2].map((i) => {
          const o = interpolate((frame + 30 - i * 7) % 30, [0, 10, 30], [0.15, 1, 0.15]);
          return <path key={i} d={`M20 ${12 + i * 38} L60 ${42 + i * 38} L100 ${12 + i * 38}`} fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" opacity={o} />;
        })}
      </svg>
      <Pop d={22} from="left" style={{position: 'absolute', top: ZONE.obj + 530, left: X, width: W}}>
        <div style={{...box(teamColor, 30, 14), height: 210, display: 'flex', alignItems: 'center', gap: 26, padding: '0 34px'}}>
          <div style={{width: 150, height: 150, flex: 'none', borderRadius: 75, background: '#fff', border: `7px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <svg width="100" height="100" viewBox="0 0 100 100">{/* coche visto de frente, genérico */}
              <rect x="6" y="58" width="22" height="30" rx="6" fill={INK} /><rect x="72" y="58" width="22" height="30" rx="6" fill={INK} />
              <path d="M30 80 L36 46 Q50 28 64 46 L70 80 Z" fill={teamColor} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
              <rect x="14" y="20" width="72" height="12" rx="4" fill={INK} /><rect x="46" y="30" width="8" height="18" fill={INK} />
            </svg>
          </div>
          <div>
            <div style={{fontFamily: T.body, fontWeight: 800, fontSize: 30, color: 'rgba(17,17,17,0.65)', letterSpacing: 2}}>EQUIPO</div>
            <div style={{fontFamily: T.display, fontSize: ts, lineHeight: 1, color: INK, whiteSpace: 'nowrap'}}>{team}</div>
          </div>
        </div>
      </Pop>
      {/* entrada "HASTA 2028" + contrato firmado */}
      <Pop d={36} style={{position: 'absolute', top: ZONE.obj + 780, left: X, width: 600}}>
        <div style={{...box('#ffd21f', 26, 12), height: 220, display: 'flex', alignItems: 'center', padding: '0 34px', gap: 22, transform: 'rotate(-2deg)'}}>
          <div style={{fontFamily: T.body, fontWeight: 800, fontSize: 34, letterSpacing: 3, writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: INK}}>HASTA</div>
          <div style={{width: 0, height: 150, borderLeft: `6px dashed ${INK}`}} />
          <div style={{fontFamily: T.display, fontSize: fitOneLine(until, 400, 170, 80), lineHeight: 1, color: INK}}>{until}</div>
        </div>
      </Pop>
      <Pop d={46} style={{position: 'absolute', top: ZONE.obj + 750, left: X + 640, width: 300}}>
        <svg width="300" height="290" viewBox="0 0 300 290" style={{transform: 'rotate(6deg)'}}>
          <rect x="34" y="14" width="212" height="262" rx="18" fill={INK} transform="translate(12 12)" />
          <rect x="34" y="14" width="212" height="262" rx="18" fill="#fff" stroke={INK} strokeWidth="7" />
          {[52, 84, 116].map((y, i) => <rect key={y} x="62" y={y} width={i === 2 ? 100 : 156} height="13" rx="6" fill="#d9d3c2" />)}
          <path d="M62 196 C84 150 96 240 118 192 C132 162 142 232 162 198 C176 176 186 216 218 186" fill="none" stroke="#ff4f9a" strokeWidth="9" strokeLinecap="round" strokeDasharray="300" strokeDashoffset={draw} />
          <g transform={`translate(214 238) scale(${seal})`}>
            <circle r="44" fill="#1fa95b" stroke={INK} strokeWidth="7" />
            <path d="M-19 2 L-6 15 L21 -13" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      </Pop>
    </Frame>
  );
};

/* ============ 5 · RUMOR: radar + sello "sin confirmar" ============ */
export const Rumor: React.FC<{cap: string; on?: string | number; who: string; n: number}> = ({cap, on, who, n}) => {
  const frame = useCurrentFrame();
  const p = useIn(4, {damping: 12, stiffness: 120, mass: 0.9});
  const st = useIn(40, {damping: 7, stiffness: 220, mass: 0.6});
  const R = 330, cx = T.width / 2, cy = ZONE.obj + 80 + R;
  const ang = (frame * 4) % 360;
  const blips = [{a: 40, r: 0.55}, {a: 150, r: 0.75}, {a: 250, r: 0.4}];
  return (
    <Frame kind="rumor" cap={cap} on={on}>
      {/* cinta de precaución */}
      <div style={{position: 'absolute', top: ZONE.obj - 4, left: -40, width: T.width + 80, height: 56, transform: 'rotate(-2deg)', border: `6px solid ${INK}`, backgroundImage: `repeating-linear-gradient(135deg, ${INK} 0 34px, #ffd21f 34px 68px)`, backgroundPosition: `${frame * 1.5}px 0`}} />
      <div style={{position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2, borderRadius: R, background: '#0d2b22', border: `9px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, overflow: 'hidden', transform: `scale(${p})`}}>
        <div style={{position: 'absolute', inset: 0, background: `conic-gradient(from ${ang}deg, rgba(77,255,160,0) 0deg, rgba(77,255,160,0) 290deg, rgba(77,255,160,0.75) 360deg)`}} />
        <svg width={R * 2} height={R * 2} viewBox={`0 0 ${R * 2} ${R * 2}`} style={{position: 'absolute', inset: 0}}>
          {[0.33, 0.66, 0.97].map((k) => <circle key={k} cx={R} cy={R} r={R * k} fill="none" stroke="rgba(77,255,160,0.55)" strokeWidth="4" />)}
          <path d={`M${R} 0 V${R * 2} M0 ${R} H${R * 2}`} stroke="rgba(77,255,160,0.4)" strokeWidth="4" />
          {blips.map((b, i) => {
            const diff = (ang - b.a + 360) % 360;
            const o = interpolate(diff, [0, 30, 260, 360], [1, 1, 0.12, 0.12]);
            const x = R + Math.cos(((b.a - 90) * Math.PI) / 180) * R * b.r, y = R + Math.sin(((b.a - 90) * Math.PI) / 180) * R * b.r;
            return <g key={i} opacity={o}><circle cx={x} cy={y} r="26" fill="rgba(77,255,160,0.3)" /><circle cx={x} cy={y} r="12" fill="#4dffa0" /></g>;
          })}
          <text x={R} y={R + 30} textAnchor="middle" fontFamily={T.display} fontSize="110" fill="#4dffa0">?</text>
        </svg>
      </div>
      {/* sello */}
      <div style={{position: 'absolute', left: X + 30, top: cy + R - 190, width: W - 60, transform: `rotate(-9deg) scale(${interpolate(st, [0, 1], [2.2, 1])})`, opacity: interpolate(st, [0, 0.4], [0, 1], clamp)}}>
        <div style={{border: `10px solid #d42a10`, borderRadius: 22, background: 'rgba(255,255,255,0.93)', color: '#d42a10', fontFamily: T.display, fontSize: fitOneLine('SIN CONFIRMAR', W - 130, 104, 60), lineHeight: 1, whiteSpace: 'nowrap', textAlign: 'center', padding: '18px 0 12px', boxShadow: `0 0 0 6px #fff`}}>SIN CONFIRMAR</div>
      </div>
      <Pop d={52} style={{position: 'absolute', top: cy + R + 60, left: X, width: W}}>
        <div style={{...box('#fff', 26, 12), height: 150, display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px'}}>
          <IconTile name="eye" size={100} bg="#ffd21f" />
          <div style={{minWidth: 0}}>
            <div style={{fontFamily: T.display, fontSize: 42, color: INK, lineHeight: 1.05}}>Solo lo cuenta {n === 1 ? '1 fuente' : `${n} fuentes`}</div>
            <div style={{fontFamily: T.body, fontWeight: 600, fontSize: fitOneLine(who, W - 220, 31, 22, T.body, 600, false), color: '#6b6252', whiteSpace: 'nowrap'}}>{who}</div>
          </div>
        </div>
      </Pop>
    </Frame>
  );
};

/* ============ 6 · CÓMO FUNCIONA: plano técnico con flujo de aire animado ============ */
export const Tecnico: React.FC<{cap: string; on?: string | number; title: string; parts: {n: number; name: string; sub: string}[]}> = ({cap, on, title, parts}) => {
  const frame = useCurrentFrame();
  const p = useIn(6, {damping: 15, stiffness: 90, mass: 1});
  const C = '#4de1ff';
  const off = -frame * 7;
  const ts = fitOneLine(title, W - 60, 60, 36, T.display, '', false);
  const down = 8 + Math.sin(frame * 0.2) * 6;
  return (
    <Frame kind="tecnico" cap={cap} on={on}>
      <div style={{position: 'absolute', top: ZONE.obj, left: X, width: W, height: 640, borderRadius: 30, border: '6px solid #fff', background: 'rgba(8,24,54,0.72)', overflow: 'hidden', opacity: p}}>
        <div style={{position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(77,225,255,0.16) 2px, transparent 2px), linear-gradient(90deg, rgba(77,225,255,0.16) 2px, transparent 2px)', backgroundSize: '40px 40px'}} />
        <div style={{position: 'absolute', top: 22, left: 30, fontFamily: T.display, fontSize: ts, color: '#fff'}}>{title}</div>
        <svg width={W - 12} height="520" viewBox="0 0 940 520" style={{position: 'absolute', top: 110, left: 0}}>
          {/* líneas de corriente por encima */}
          {[70, 112, 154].map((y, i) => (
            <path key={y} d={`M-20 ${y + 60} C160 ${y + 60} 250 ${y - 10} 420 ${y - 20 + i * 6} C560 ${y - 28 + i * 8} 640 ${y - 70 + i * 22} 760 ${y - 80 + i * 26} L980 ${y - 96 + i * 30}`} fill="none" stroke={C} strokeWidth="6" strokeLinecap="round" strokeDasharray="34 26" strokeDashoffset={off} opacity={0.9 - i * 0.18} />
          ))}
          {/* aire rápido bajo el suelo */}
          <path d="M-20 392 C140 392 200 372 300 366 L640 366 C720 366 800 330 980 300" fill="none" stroke="#ff4f9a" strokeWidth="9" strokeLinecap="round" strokeDasharray="22 16" strokeDashoffset={off * 1.9} />
          {/* suelo/asfalto */}
          <line x1="0" y1="404" x2="940" y2="404" stroke="#fff" strokeWidth="6" />
          {Array.from({length: 13}).map((_, i) => <line key={i} x1={i * 80 + ((off * 2) % 80)} y1="424" x2={i * 80 + 40 + ((off * 2) % 80)} y2="424" stroke="rgba(255,255,255,0.4)" strokeWidth="6" strokeLinecap="round" />)}
          {/* coche genérico de perfil (dibujo propio, sin decoración de ningún equipo) */}
          <g transform={`translate(0 ${down * 0.25})`} stroke="#fff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
            <path d="M118 348 L250 332 L372 300 L430 298 C452 256 500 240 548 250 L572 268 L660 276 L742 294 L800 304 L800 350 L690 356 L300 356 L250 352 Z" fill="#0f2d5c" />
            <path d="M548 250 L560 212 L612 218 L636 274" fill="#0f2d5c" />
            <path d="M440 292 Q490 236 556 262" fill="none" strokeWidth="9" />
            <path d="M96 356 L236 356 L236 340 L112 344 Z" fill={C} stroke="#fff" />
            <path d="M776 206 L836 206 L836 232 L776 232 Z M786 242 L836 242 L836 260 L786 260 Z" fill={C} />
            <path d="M836 196 L852 196 L852 330 L836 330 Z" fill="#0f2d5c" />
            <path d="M800 304 L812 264" fill="none" />
            <circle cx="262" cy="350" r="56" fill="#061630" /><circle cx="262" cy="350" r="22" fill="#0f2d5c" />
            <circle cx="716" cy="346" r="60" fill="#061630" /><circle cx="716" cy="346" r="24" fill="#0f2d5c" />
          </g>
          {/* carga aerodinámica: flechas hacia abajo */}
          {[180, 490, 812].map((x, i) => (
            <g key={x} transform={`translate(${x} ${[278, 180, 130][i] + down})`} opacity="0.95">
              <path d="M0 -44 V0 M-16 -18 L0 2 L16 -18" fill="none" stroke="#ffd21f" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
          {/* números de referencia */}
          {[{x: 150, y: 462}, {x: 490, y: 462}, {x: 880, y: 150}].map((c, i) => (
            <g key={i}><circle cx={c.x} cy={c.y} r="28" fill="#ffd21f" stroke={INK} strokeWidth="5" /><text x={c.x} y={c.y + 11} textAnchor="middle" fontFamily={T.display} fontSize="30" fill={INK}>{i + 1}</text></g>
          ))}
        </svg>
      </div>
      {parts.slice(0, 3).map((pt, i) => {
        const ns = fitOneLine(pt.name, W - 170, 40, 26, T.display, '', false);
        const ss = fitOneLine(pt.sub, W - 170, 29, 20, T.body, 600, false);
        return (
          <Pop key={i} d={26 + i * 12} from="left" style={{position: 'absolute', top: ZONE.obj + 664 + i * 120, left: X, width: W}}>
            <div style={{height: 104, borderRadius: 22, background: '#fff', border: `6px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, display: 'flex', alignItems: 'center', gap: 20, padding: '0 20px'}}>
              <div style={{width: 68, height: 68, flex: 'none', borderRadius: 34, background: '#ffd21f', border: `5px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontSize: 36}}>{pt.n}</div>
              <div style={{minWidth: 0}}>
                <div style={{fontFamily: T.display, fontSize: ns, lineHeight: 1.05, color: INK, whiteSpace: 'nowrap'}}>{pt.name}</div>
                <div style={{fontFamily: T.body, fontWeight: 600, fontSize: ss, color: '#6b6252', whiteSpace: 'nowrap'}}>{pt.sub}</div>
              </div>
            </div>
          </Pop>
        );
      })}
    </Frame>
  );
};

/* ============ 7 · FUENTES (cierre de todos los reels) ============ */
export const Fuentes: React.FC<{cap: string; on?: string | number; sources: {name: string; domain: string; official?: boolean}[]}> = ({cap, on, sources}) => {
  const s = sources.slice(0, 4);
  const seal = useIn(20 + s.length * 14 + 10, {damping: 8, stiffness: 180, mass: 0.7});
  return (
    <Frame kind="fuentes" cap={cap} on={on}>
      <Clipboard title="¿Quién lo cuenta?" rowH={rowHeight(s.length)}>
        {s.map((x, i) => <Row key={i} h={rowHeight(s.length)} d={12 + i * 14} icon={x.official ? 'flag' : 'doc'} title={x.name} sub={x.domain} badge={x.official ? 'OFICIAL' : undefined} tileBg={x.official ? '#cfe0ff' : '#fff'} />)}
      </Clipboard>
      <div style={{position: 'absolute', right: X - 6, top: ZONE.obj + ZONE.objH - 250, transform: `rotate(-12deg) scale(${interpolate(seal, [0, 1], [2, 1])})`, opacity: interpolate(seal, [0, 0.4], [0, 1], clamp)}}>
        <div style={{width: 250, height: 250, borderRadius: 125, background: '#1fa95b', border: `8px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff'}}>
          <div style={{fontFamily: T.display, fontSize: 112, lineHeight: 0.9}}>{sources.length}</div>
          <div style={{fontFamily: T.body, fontWeight: 800, fontSize: 30, letterSpacing: 1}}>FUENTES</div>
          <div style={{fontFamily: T.body, fontWeight: 800, fontSize: 19, letterSpacing: 1.5, opacity: 0.9}}>CONTRASTADO</div>
        </div>
      </div>
    </Frame>
  );
};

/* ============ 8 · CIERRE: llamada a seguir la cuenta ============ */
export const Cierre: React.FC<{cap: string; on?: string | number}> = ({cap, on}) => {
  const frame = useCurrentFrame();
  const m = useIn(4, {damping: 8, stiffness: 120, mass: 0.8});
  const bob = useBob(12, 0.1);
  const pulse = 1 + Math.sin(frame * 0.25) * 0.04;
  return (
    <Frame kind="cta" cap={cap} on={on}>
      <div style={{position: 'absolute', left: T.width / 2 - 450, top: ZONE.obj + 10, width: 900, height: 900, opacity: 0.6, transform: `rotate(${frame * 0.5}deg)`, background: 'repeating-conic-gradient(#fff 0deg 9deg, transparent 9deg 18deg)', WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 68%)', maskImage: 'radial-gradient(circle, #000 30%, transparent 68%)'}} />
      <div style={{position: 'absolute', left: T.width / 2 - 250, top: ZONE.obj + 90 + bob, transform: `scale(${m}) rotate(${interpolate(m, [0, 1], [-20, -6])}deg)`}}><Mascot size={500} mood="wow" /></div>
      <Pop d={16} style={{position: 'absolute', top: ZONE.obj + 640, left: X, width: W, display: 'flex', justifyContent: 'center'}}>
        <div style={{...box('#fff', 26, 12), fontFamily: T.display, fontSize: 70, padding: '14px 40px', color: INK}}>{T.handle}</div>
      </Pop>
      <Pop d={28} from="scale" style={{position: 'absolute', top: ZONE.obj + 830, left: X, width: W, display: 'flex', justifyContent: 'center'}}>
        <div style={{...box('#ff3b1d', 999, 10), fontFamily: T.display, fontSize: 64, padding: '16px 70px', color: '#fff', transform: `scale(${pulse})`}}>SEGUIR +</div>
      </Pop>
    </Frame>
  );
};
