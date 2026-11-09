import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme as T} from './theme';

/* ---------- utilidades de animación ---------- */

/** Entrada con muelle 0→1 a partir de `delay` frames. */
export const useIn = (delay = 0, cfg = T.spring) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: cfg});
};

/** Pequeño "latido" continuo para que nada quede estático. */
export const useBob = (amp = 6, speed = 0.08, phase = 0) => {
  const frame = useCurrentFrame();
  return Math.sin(frame * speed + phase) * amp;
};

/* ---------- fondos ---------- */

export const Backdrop: React.FC<{variant?: 'cream' | 'dark' | 'yellow'}> = ({variant = 'cream'}) => {
  const frame = useCurrentFrame();
  if (variant === 'dark') {
    const rot = frame * 0.25;
    return (
      <AbsoluteFill style={{background: T.ink, overflow: 'hidden'}}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '42%',
            width: 3200,
            height: 3200,
            marginLeft: -1600,
            marginTop: -1600,
            transform: `rotate(${rot}deg)`,
            background: `repeating-conic-gradient(#262626 0deg 7.5deg, ${T.ink} 7.5deg 15deg)`,
          }}
        />
        <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 42%, transparent 25%, rgba(0,0,0,0.65) 85%)'}} />
      </AbsoluteFill>
    );
  }
  const bg = variant === 'yellow' ? T.yellow : T.cream;
  return (
    <AbsoluteFill style={{background: bg}}>
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(17,17,17,0.12) 2.5px, transparent 3px)',
          backgroundSize: '44px 44px',
          backgroundPosition: `${(frame * 0.6) % 44}px ${(frame * 0.6) % 44}px`,
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------- mascota original: casco con ojos ---------- */

export const Mascot: React.FC<{size?: number; mood?: 'happy' | 'wow'}> = ({size = 180, mood = 'happy'}) => {
  const blink = useCurrentFrame() % 96 > 91 ? 0.1 : 1;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {/* sombra dura */}
      <ellipse cx="108" cy="188" rx="64" ry="9" fill="rgba(0,0,0,0.25)" />
      {/* casco */}
      <path d="M26 112 C26 52 66 22 112 22 C158 22 182 62 182 112 L182 148 C182 160 172 168 160 168 L52 168 C36 168 26 156 26 140 Z"
        fill={T.red} stroke={T.ink} strokeWidth="9" strokeLinejoin="round" />
      {/* franja */}
      <path d="M74 24 C92 22 104 22 118 24 L118 170 L84 170 Z" fill={T.yellow} stroke={T.ink} strokeWidth="7" />
      {/* visera */}
      <path d="M92 86 C92 74 102 68 116 68 L172 68 C180 68 184 74 184 82 L184 112 C184 124 176 130 166 130 L112 130 C100 130 92 122 92 110 Z"
        fill={T.ink} />
      <path d="M100 76 L150 76" stroke="rgba(255,255,255,0.35)" strokeWidth="6" strokeLinecap="round" />
      {/* ojos */}
      <g transform={`translate(0 ${mood === 'wow' ? -2 : 0})`}>
        <ellipse cx="124" cy="103" rx="11" ry={13 * blink} fill={T.white} />
        <ellipse cx="156" cy="103" rx="11" ry={13 * blink} fill={T.white} />
        <circle cx="127" cy="105" r="5" fill={T.ink} />
        <circle cx="159" cy="105" r="5" fill={T.ink} />
      </g>
      {/* número */}
      <text x="44" y="132" fontFamily={T.display} fontSize="40" fill={T.white} stroke={T.ink} strokeWidth="2">1</text>
    </svg>
  );
};

/* ---------- cabecera con marca ---------- */

export const Header: React.FC<{tag: string; dark?: boolean}> = ({tag, dark}) => {
  const p = useIn(0);
  return (
    <div
      style={{
        position: 'absolute',
        top: T.safeTop - 40,
        left: T.safeX,
        right: T.safeX,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [-40, 0])}px)`,
      }}
    >
      <div style={{width: 120, height: 120, marginTop: -6}}>
        <Mascot size={120} />
      </div>
      <div>
        <div style={{fontFamily: T.display, fontSize: 52, color: dark ? T.white : T.ink, lineHeight: 1}}>{T.brand}</div>
        <div
          style={{
            marginTop: 8,
            display: 'inline-block',
            fontFamily: T.mono,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: 3,
            background: T.yellow,
            color: T.ink,
            border: `4px solid ${T.ink}`,
            padding: '2px 14px',
            textTransform: 'uppercase',
          }}
        >
          {tag}
        </div>
      </div>
    </div>
  );
};

/* ---------- texto ---------- */

/** Palabra o frase con resalte tipo rotulador que se "pinta" de izquierda a derecha. */
export const Hl: React.FC<{children: React.ReactNode; delay?: number; color?: string; ink?: string}> = ({
  children,
  delay = 0,
  color = T.yellow,
  ink = T.ink,
}) => {
  const p = useIn(delay, {damping: 18, stiffness: 120, mass: 0.8});
  return (
    <span
      style={{
        color: ink,
        padding: '0 0.14em',
        backgroundImage: `linear-gradient(${color}, ${color})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${interpolate(p, [0, 1], [0, 100])}% 88%`,
        backgroundPosition: '0 62%',
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
      }}
    >
      {children}
    </span>
  );
};

/** Titular enorme que entra palabra a palabra. `hl` = palabras a resaltar. */
export const Headline: React.FC<{
  text: string;
  size?: number;
  delay?: number;
  hl?: string[];
  color?: string;
  align?: 'left' | 'center';
}> = ({text, size = 128, delay = 0, hl = [], color = T.ink, align = 'left'}) => {
  const words = text.split(' ');
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: `0 ${size * 0.2}px`,
        fontFamily: T.display,
        fontSize: size,
        lineHeight: 1.04,
        textTransform: 'uppercase',
        color,
      }}
    >
      {words.map((w, i) => (
        <HeadWord key={i} i={i} delay={delay + i * 4} highlighted={hl.includes(w)}>
          {w}
        </HeadWord>
      ))}
    </div>
  );
};

const HeadWord: React.FC<{children: string; delay: number; highlighted: boolean; i: number}> = ({
  children,
  delay,
  highlighted,
}) => {
  const p = useIn(delay);
  return (
    <span
      style={{
        display: 'inline-block',
        opacity: interpolate(p, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'}),
        transform: `translateY(${interpolate(p, [0, 1], [90, 0])}px) rotate(${interpolate(p, [0, 1], [-6, 0])}deg) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
      }}
    >
      {highlighted ? <Hl delay={delay + 6}>{children}</Hl> : children}
    </span>
  );
};

/* ---------- tarjetas y pegatinas ---------- */

export const Card: React.FC<{
  children: React.ReactNode;
  delay?: number;
  rotate?: number;
  bg?: string;
  style?: React.CSSProperties;
}> = ({children, delay = 0, rotate = 0, bg = T.white, style}) => {
  const p = useIn(delay);
  return (
    <div
      style={{
        background: bg,
        border: `${T.border}px solid ${T.ink}`,
        borderRadius: T.radius,
        boxShadow: `${T.shadow}px ${T.shadow}px 0 ${T.ink}`,
        opacity: interpolate(p, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
        transform: `translateY(${interpolate(p, [0, 1], [140, 0])}px) rotate(${interpolate(p, [0, 1], [rotate * 4, rotate])}deg) scale(${interpolate(p, [0, 1], [0.85, 1])})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Sticker: React.FC<{
  children: React.ReactNode;
  delay?: number;
  rotate?: number;
  bg?: string;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({children, delay = 0, rotate = -6, bg = T.yellow, color = T.ink, size = 40, style}) => {
  const p = useIn(delay, {damping: 9, stiffness: 190, mass: 0.6});
  return (
    <div
      style={{
        display: 'inline-block',
        fontFamily: T.display,
        fontSize: size,
        textTransform: 'uppercase',
        background: bg,
        color,
        border: `${T.border - 2}px solid ${T.ink}`,
        borderRadius: 18,
        padding: '8px 22px',
        boxShadow: `8px 8px 0 ${T.ink}`,
        transform: `rotate(${rotate}deg) scale(${p})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Banda de cuadros (meta) para decorar. */
export const Checker: React.FC<{height?: number; style?: React.CSSProperties}> = ({height = 44, style}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        height,
        width: '100%',
        backgroundImage: `repeating-conic-gradient(${T.ink} 0 25%, ${T.white} 0 50%)`,
        backgroundSize: `${height}px ${height}px`,
        backgroundPosition: `${(frame * 2) % (height * 2)}px 0`,
        borderTop: `5px solid ${T.ink}`,
        borderBottom: `5px solid ${T.ink}`,
        ...style,
      }}
    />
  );
};

/* ---------- transición entre escenas ---------- */

/** Barras que barren la pantalla. Colócala en el frame `at` del vídeo (usa <Sequence from={at - 8}>). */
export const Wipe: React.FC = () => {
  const frame = useCurrentFrame();
  const t = (d: number) =>
    interpolate(frame, [d, d + 16], [-110, 110], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bars = [
    {c: T.red, d: 0},
    {c: T.yellow, d: 3},
    {c: T.ink, d: 6},
  ];
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      {bars.map((b, i) => (
        <AbsoluteFill key={i} style={{background: b.c, transform: `translateX(${t(b.d)}%) skewX(-12deg) scaleX(1.3)`}} />
      ))}
    </AbsoluteFill>
  );
};

/* ---------- pie con llamada a la acción ---------- */

export const Footer: React.FC<{dark?: boolean; delay?: number}> = ({dark, delay = 0}) => {
  const p = useIn(delay);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: T.safeBottom - 120,
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity: p,
        fontFamily: T.mono,
        fontWeight: 700,
        fontSize: 34,
        letterSpacing: 3,
        color: dark ? T.white : T.ink,
      }}
    >
      {T.handle}
    </div>
  );
};
