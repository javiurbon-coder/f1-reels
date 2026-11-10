import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import './fonts';
import {Backdrop, Card, Footer, Headline, Header, Mascot, Sticker, Wipe, useBob, useIn} from './kit';
import {theme as T} from './theme';
import {renderScene} from './scenes';
import type {Scene} from './sceneTypes';

export type NoticiaProps = {
  headline: string;
  level: 'ALTA' | 'MEDIA' | 'OFICIAL';
  date: string;
  sources: {name: string; domain: string; official?: boolean; tier?: string}[];
  alsoSay?: string[];
  /** Puntos clave (frases del guion) que salen en pantalla mientras suena la voz. */
  points?: string[];
  /** Storyboard (escenas con tiempos en segundos). Si existe, sustituye al diseño antiguo. */
  scenes?: Scene[];
  /** Voz en off (opcional): audio en public/ + palabras con tiempos para subtitular. */
  narration?: {file: string; seconds: number; words: {t: string; start: number; end: number}[]};
};

export const NOTICIA_SCENES = {hook: 120, sources: 150};
export const NOTICIA_TOTAL = NOTICIA_SCENES.hook + NOTICIA_SCENES.sources;
/** Con voz en off, el vídeo dura lo que dura el audio (+0,5 s) y la 2ª escena absorbe la diferencia. */
export const noticiaDuration = (p: Partial<NoticiaProps>, fps = 30) =>
  p.scenes?.length ? Math.ceil(p.scenes[p.scenes.length - 1].to * fps) : p.narration ? Math.max(NOTICIA_TOTAL, Math.ceil((p.narration.seconds + 0.5) * fps)) : NOTICIA_TOTAL;

const LEVEL_TEXT: Record<NoticiaProps['level'], string> = {
  ALTA: 'Confirmado por varias fuentes',
  MEDIA: 'Contrastado con 2 fuentes',
  OFICIAL: 'Fuente oficial',
};

// El tamaño del titular se adapta a su longitud para que siempre quepa.
export const sizeFor = (s: string) => (s.length < 30 ? 150 : s.length < 46 ? 120 : s.length < 70 ? 98 : 80);

// Palabra a resaltar: la primera con mayúscula inicial que no sea la primera del titular (suele ser un nombre propio).
export const pickHighlight = (s: string) => {
  const w = s.split(' ');
  return [w.slice(1).find((x) => /^[A-ZÁÉÍÓÚÑ]/.test(x) && x.length > 3) ?? w[0]];
};

const Hook: React.FC<NoticiaProps> = ({headline, level, date, sources}) => {
  const bob = useBob(8, 0.1);
  const p = useIn(40);
  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <Header tag="Última hora" dark />
      <AbsoluteFill style={{padding: `${T.safeTop + 180}px ${T.safeX}px 0`}}>
        <div style={{display: 'flex', gap: 16, alignItems: 'center', marginBottom: 34}}>
          <Sticker delay={4} rotate={-3} size={34} bg={level === 'OFICIAL' ? T.blue : T.yellow} color={level === 'OFICIAL' ? T.white : T.ink}>
            {level === 'OFICIAL' ? 'Oficial' : `${sources.length} fuentes`}
          </Sticker>
          <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 32, color: T.yellow, letterSpacing: 3}}>{date}</div>
        </div>
        <Headline text={headline} size={sizeFor(headline)} delay={8} hl={pickHighlight(headline)} color={T.white} />
      </AbsoluteFill>
      <div style={{position: 'absolute', right: 30, bottom: T.safeBottom + 20, transform: `translateY(${bob}px) rotate(${interpolate(p, [0, 1], [18, -8])}deg) scale(${p})`}}>
        <Mascot size={headline.length > 46 ? 240 : 330} />
      </div>
    </AbsoluteFill>
  );
};

const Check: React.FC = () => (
  <svg width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="29" fill={T.yellow} stroke={T.ink} strokeWidth="6" />
    <path d="M17 33 L28 44 L47 21" fill="none" stroke={T.ink} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Sources: React.FC<Pick<NoticiaProps, 'sources' | 'alsoSay'> & {level?: NoticiaProps['level']; levelLabel?: string; heading?: string; tag?: string; accent?: string}> = ({sources, level, alsoSay = [], levelLabel, heading = '¿Quién lo cuenta?', tag = 'Fuentes', accent}) => {
  const shown = sources.slice(0, 6);
  return (
    <AbsoluteFill>
      <Backdrop variant="cream" />
      <Header tag={tag} />
      <AbsoluteFill style={{padding: `${T.safeTop + 160}px ${T.safeX}px 0`}}>
        <div style={{marginBottom: 36}}>
          <Headline text={heading} size={96} delay={0} hl={[heading.split(' ').pop() as string]} />
        </div>
        {shown.map((s, i) => (
          <Card key={s.name} delay={14 + i * 12} rotate={i % 2 ? 0.8 : -0.8} style={{height: 138, display: 'flex', alignItems: 'center', gap: 26, padding: '0 30px', marginBottom: 26, borderRadius: 22}}>
            <Check />
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontFamily: T.display, fontSize: 52, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.name}</div>
              <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 27, color: T.muted}}>{s.domain}</div>
            </div>
            {(s.official || s.tier === 'periodista') && (
              <Sticker size={24} rotate={4} bg={s.official ? T.blue : T.red} color={T.white} delay={20 + i * 12} style={{padding: '4px 14px'}}>
                {s.official ? 'Oficial' : 'Periodista'}
              </Sticker>
            )}
          </Card>
        ))}
        <div style={{marginTop: 14}}>
          <Sticker delay={14 + shown.length * 12 + 10} rotate={-2} bg={T.ink} color={T.yellow} size={40}>
            {levelLabel ?? LEVEL_TEXT[level ?? 'MEDIA']}
          </Sticker>
        </div>
        {alsoSay.length > 0 && (
          <div style={{marginTop: 30, fontFamily: T.mono, fontWeight: 700, fontSize: 30, color: T.muted, opacity: useIn(14 + shown.length * 12 + 24)}}>
            También lo comentan: {alsoSay.slice(0, 3).join(', ')}
          </div>
        )}
      </AbsoluteFill>
      <Footer delay={60} />
    </AbsoluteFill>
  );
};

export const Points: React.FC<{points: string[]; frames: number}> = ({points, frames}) => {
  const step = Math.max(24, Math.floor((frames - 30) / points.length));
  return (
    <AbsoluteFill>
      <Backdrop variant="cream" />
      <Header tag="Lo que sabemos" />
      <AbsoluteFill style={{padding: `${T.safeTop + 160}px ${T.safeX}px 0`}}>
        <div style={{marginBottom: 40}}>
          <Headline text="Lo que sabemos" size={96} delay={0} hl={['sabemos']} />
        </div>
        {points.map((t, i) => (
          <Card key={i} delay={10 + i * step} rotate={i % 2 ? 0.8 : -0.8} style={{padding: '26px 34px', marginBottom: 28, borderRadius: 22}}>
            <div style={{fontFamily: T.display, fontSize: t.length > 90 ? 40 : 46, lineHeight: 1.12, textTransform: 'uppercase'}}>{t}</div>
          </Card>
        ))}
      </AbsoluteFill>
      <Footer delay={60} />
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{words: {t: string; start: number; end: number}[]; top?: number; size?: number; group?: number; offset?: number}> = ({words, top = 1010, size = 64, group = 4, offset = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = frame / fps + offset;
  // grupos de 4 palabras; se muestra el grupo activo y la palabra que suena se resalta
  const groups: typeof words[] = [];
  for (let i = 0; i < words.length; i += group) groups.push(words.slice(i, i + group));
  const g = groups.find((w) => now >= w[0].start - 0.05 && now <= w[w.length - 1].end + 0.25);
  if (!g) return null;
  return (
    <div style={{position: 'absolute', left: T.safeX, right: T.safeX, top, textAlign: 'center', fontFamily: T.display, fontSize: size, lineHeight: 1.1, textTransform: 'uppercase'}}>
      {g.map((w, i) => {
        const on = now >= w.start && now < w.end + 0.05;
        return (
          <span key={i} style={{background: on ? T.yellow : T.white, color: T.ink, border: `4px solid ${T.ink}`, boxShadow: `6px 6px 0 ${T.ink}`, padding: '2px 12px', margin: '0 6px 10px', display: 'inline-block'}}>
            {w.t}
          </span>
        );
      })}
    </div>
  );
};

/** Voz en off + subtítulos para cualquier plantilla (se pone el último para quedar por encima). */
export const Voice: React.FC<{narration?: NoticiaProps['narration']}> = ({narration}) =>
  narration ? (
    <>
      <Audio src={staticFile(narration.file)} />
      <Captions words={narration.words} />
    </>
  ) : null;

export const withVoice = (total: number, narration?: NoticiaProps['narration'], fps = 30) =>
  narration ? Math.max(total, Math.ceil((narration.seconds + 0.5) * fps)) : total;

const Storyboard: React.FC<NoticiaProps & {scenes: Scene[]}> = (props) => {
  const {fps} = useVideoConfig();
  const sc = props.scenes;
  const mid = sc.filter((s) => s.type !== 'hook' && s.type !== 'sources');
  return (
    <AbsoluteFill>
      {props.narration && <Audio src={staticFile(props.narration.file)} />}
      {sc.map((s, i) => {
        const from = Math.round(s.from * fps);
        const dur = Math.round((s.to - s.from) * fps) + (i < sc.length - 1 ? 6 : 0);
        return (
          <React.Fragment key={i}>
            <Sequence from={from} durationInFrames={dur}>
              {s.type === 'hook' ? <Hook {...props} /> : s.type === 'sources' ? <Sources {...props} /> : renderScene(s, i)}
            </Sequence>
            {i > 0 && (
              <Sequence from={from - 8} durationInFrames={22}>
                <Wipe />
              </Sequence>
            )}
          </React.Fragment>
        );
      })}
      {props.narration && mid.length > 0 && (
        <Sequence from={Math.round(mid[0].from * fps)} durationInFrames={Math.round((mid[mid.length - 1].to - mid[0].from) * fps)}>
          <Captions words={props.narration.words} top={1300} size={58} group={3} offset={mid[0].from} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

export const NoticiaVerificada: React.FC<NoticiaProps> = (props) => {
  if (props.scenes?.length) return <Storyboard {...props} scenes={props.scenes} />;
  const {hook} = NOTICIA_SCENES;
  const total = useVideoConfig().durationInFrames;
  const pts = props.points ?? [];
  const tail = NOTICIA_SCENES.sources + 60; // las fuentes se quedan unos 7 s al final
  const midFrames = total - hook - tail;
  const withPoints = pts.length > 0 && midFrames > 90;
  const srcFrom = withPoints ? total - tail : hook;
  return (
    <AbsoluteFill>
      {props.narration && <Audio src={staticFile(props.narration.file)} />}
      <Sequence from={0} durationInFrames={hook + 6}>
        <Hook {...props} />
      </Sequence>
      {withPoints && (
        <Sequence from={hook} durationInFrames={midFrames + 6}>
          <Points points={pts} frames={midFrames} />
        </Sequence>
      )}
      <Sequence from={srcFrom}>
        <Sources {...props} />
      </Sequence>
      <Sequence from={hook - 8} durationInFrames={22}>
        <Wipe />
      </Sequence>
      {withPoints && (
        <Sequence from={srcFrom - 8} durationInFrames={22}>
          <Wipe />
        </Sequence>
      )}
      {props.narration && <Captions words={props.narration.words} />}
    </AbsoluteFill>
  );
};
