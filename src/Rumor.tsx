import React from 'react';
import {AbsoluteFill, Sequence, interpolate} from 'remotion';
import './fonts';
import {Backdrop, Card, Headline, Header, Mascot, Sticker, Wipe, useBob, useIn} from './kit';
import {NoticiaProps, Sources, Voice, pickHighlight, sizeFor, withVoice} from './NoticiaVerificada';
import {theme as T} from './theme';

/** Rumor: NUNCA se presenta como hecho. Siempre lleva el sello NO CONFIRMADO. */
export type RumorProps = {
  headline: string;
  date: string;
  sources: NoticiaProps['sources'];
  alsoSay?: string[];
  narration?: NoticiaProps['narration'];
};

export const RUMOR_SCENES = {hook: 120, sources: 150};
export const RUMOR_TOTAL = RUMOR_SCENES.hook + RUMOR_SCENES.sources;
export const rumorDuration = (p: Partial<RumorProps>) => withVoice(RUMOR_TOTAL, p.narration);

const Hook: React.FC<RumorProps> = ({headline, date, sources}) => {
  const bob = useBob(8, 0.1);
  const stamp = useIn(6, {damping: 8, stiffness: 220, mass: 0.7});
  const p = useIn(40);
  return (
    <AbsoluteFill>
      <Backdrop variant="yellow" />
      <Header tag="Rumor o realidad" />
      <AbsoluteFill style={{padding: `${T.safeTop + 170}px ${T.safeX}px 0`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30}}>
          <div style={{fontFamily: T.display, fontSize: 84, textTransform: 'uppercase', background: T.red, color: T.white, border: `6px solid ${T.ink}`, boxShadow: `8px 8px 0 ${T.ink}`, padding: '4px 26px', transform: `rotate(${interpolate(stamp, [0, 1], [-18, -4])}deg) scale(${stamp})`}}>
            No confirmado
          </div>
        </div>
        <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 32, letterSpacing: 3, marginBottom: 26}}>{date} · {sources.length === 0 ? 'sin medios contrastados' : `${sources.length} ${sources.length === 1 ? 'fuente' : 'fuentes'}`}</div>
        <Headline text={headline} size={sizeFor(headline)} delay={10} hl={pickHighlight(headline)} />
      </AbsoluteFill>
      <div style={{position: 'absolute', right: 30, bottom: T.safeBottom + 20, transform: `translateY(${bob}px) rotate(${interpolate(p, [0, 1], [18, -8])}deg) scale(${p})`}}>
        <Mascot size={headline.length > 46 ? 240 : 300} />
      </div>
    </AbsoluteFill>
  );
};

export const Rumor: React.FC<RumorProps> = (props) => {
  const {hook} = RUMOR_SCENES;
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={hook + 6}><Hook {...props} /></Sequence>
      <Sequence from={hook}>
        <Sources sources={props.sources} alsoSay={props.alsoSay} heading="¿Quién lo dice?" tag="Rumor · fuentes" levelLabel="Sin confirmación oficial" />
      </Sequence>
      <Sequence from={hook - 8} durationInFrames={22}><Wipe /></Sequence>
      <Voice narration={props.narration} />
    </AbsoluteFill>
  );
};
