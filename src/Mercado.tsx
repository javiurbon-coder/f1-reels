import React from 'react';
import {AbsoluteFill, Sequence, interpolate} from 'remotion';
import './fonts';
import {Backdrop, Card, Headline, Header, Mascot, Sticker, Wipe, useBob, useIn} from './kit';
import {NoticiaProps, Sources, Voice, pickHighlight, sizeFor, withVoice} from './NoticiaVerificada';
import {theme as T} from './theme';

export type MercadoProps = Omit<NoticiaProps, 'level'> & {
  level: NoticiaProps['level'];
  kind: 'FICHAJE' | 'RENOVACIÓN' | 'SALIDA' | 'CONTRATO';
  /** Opcional: movimiento "de → a" (equipo/puesto). Si falta, no se dibuja. */
  from?: string;
  to?: string;
};

export const MERCADO_SCENES = {hook: 120, sources: 150};
export const MERCADO_TOTAL = MERCADO_SCENES.hook + MERCADO_SCENES.sources;
export const mercadoDuration = (p: Partial<MercadoProps>) => withVoice(MERCADO_TOTAL, p.narration);

const Hook: React.FC<MercadoProps> = ({headline, kind, date, from, to, sources}) => {
  const bob = useBob(8, 0.1);
  const p = useIn(40);
  const arrow = useIn(26);
  const box = (label: string, text: string, delay: number, bg: string, color: string) => (
    <Card delay={delay} bg={bg} style={{flex: 1, padding: '22px 26px', minWidth: 0}}>
      <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 26, letterSpacing: 3, color}}>{label}</div>
      <div style={{fontFamily: T.display, fontSize: text.length > 22 ? 36 : text.length > 12 ? 44 : 56, textTransform: 'uppercase', lineHeight: 1.05, color, marginTop: 6, wordBreak: 'break-word'}}>{text}</div>
    </Card>
  );
  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <Header tag="Mercado" dark />
      <AbsoluteFill style={{padding: `${T.safeTop + 180}px ${T.safeX}px 0`}}>
        <div style={{display: 'flex', gap: 16, alignItems: 'center', marginBottom: 34}}>
          <Sticker delay={4} rotate={-3} size={34} bg={T.red} color={T.white}>{kind}</Sticker>
          <Sticker delay={10} rotate={2} size={30}>{`${sources.length} ${sources.length === 1 ? 'fuente' : 'fuentes'}`}</Sticker>
          <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 32, color: T.yellow, letterSpacing: 3}}>{date}</div>
        </div>
        <Headline text={headline} size={sizeFor(headline)} delay={8} hl={pickHighlight(headline)} color={T.white} />
      </AbsoluteFill>
      {from && to && (
        <div style={{position: 'absolute', left: T.safeX, right: T.safeX, top: 1000, display: 'flex', alignItems: 'center', gap: 18}}>
          {box('DE', from, 30, T.white, T.ink)}
          <div style={{fontFamily: T.display, fontSize: 80, color: T.yellow, opacity: arrow, transform: `translateX(${interpolate(arrow, [0, 1], [-20, 0])}px)`}}>→</div>
          {box('A', to, 38, T.yellow, T.ink)}
        </div>
      )}
      <div style={{position: 'absolute', right: 30, bottom: T.safeBottom + 20, transform: `translateY(${bob}px) rotate(${interpolate(p, [0, 1], [18, -8])}deg) scale(${p})`}}>
        <Mascot size={headline.length > 46 ? 240 : 300} />
      </div>
    </AbsoluteFill>
  );
};

export const Mercado: React.FC<MercadoProps> = (props) => {
  const {hook} = MERCADO_SCENES;
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={hook + 6}><Hook {...props} /></Sequence>
      <Sequence from={hook}><Sources sources={props.sources} alsoSay={props.alsoSay} level={props.level} tag="Mercado · fuentes" /></Sequence>
      <Sequence from={hook - 8} durationInFrames={22}><Wipe /></Sequence>
      <Voice narration={props.narration} />
    </AbsoluteFill>
  );
};
