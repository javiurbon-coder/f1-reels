import React from 'react';
import {AbsoluteFill, Sequence, interpolate, useCurrentFrame} from 'remotion';
import './fonts';
import {Backdrop, Card, Checker, Footer, Headline, Header, Mascot, Sticker, Wipe, useBob, useIn} from './kit';
import {theme as T} from './theme';

export type DatoProps = {
  tag: string;
  question: string; // gancho en forma de pregunta
  hl: string[];
  value: number;
  decimals?: number;
  unit: string;
  caption: string;
  compare?: {label: string; value: string};
};

export const DATO_SCENES = {hook: 78, reveal: 156};
export const DATO_TOTAL = DATO_SCENES.hook + DATO_SCENES.reveal;

const Hook: React.FC<DatoProps> = ({tag, question, hl}) => {
  const bob = useBob(9, 0.1);
  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <Header tag={tag} dark />
      <AbsoluteFill style={{padding: `${T.safeTop + 200}px ${T.safeX}px 0`}}>
        <Headline text={question} size={140} delay={3} hl={hl} color={T.white} />
      </AbsoluteFill>
      <div style={{position: 'absolute', right: 40, bottom: T.safeBottom + 30, transform: `translateY(${bob}px) rotate(-8deg)`}}>
        <Mascot size={360} mood="wow" />
      </div>
    </AbsoluteFill>
  );
};

const Reveal: React.FC<DatoProps> = ({tag, value, decimals = 0, unit, caption, compare}) => {
  const frame = useCurrentFrame();
  const count = interpolate(frame, [10, 70], [0, value], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const shown = decimals > 0 ? count.toFixed(decimals).replace('.', ',') : Math.round(count).toLocaleString('es-ES');
  const done = frame > 70;
  const pop = useIn(70, {damping: 7, stiffness: 200, mass: 0.6});
  return (
    <AbsoluteFill>
      <Backdrop variant="yellow" />
      <Header tag={tag} />
      <AbsoluteFill style={{padding: `${T.safeTop + 200}px ${T.safeX}px 0`, alignItems: 'center'}}>
        <Card delay={0} rotate={-1.5} bg={T.white} style={{padding: '70px 40px 56px', textAlign: 'center', width: '100%'}}>
          <div
            style={{
              fontFamily: T.display,
              fontSize: shown.length > 5 ? 260 : 360,
              lineHeight: 1,
              transform: done ? `scale(${interpolate(pop, [0, 1], [1.12, 1])})` : undefined,
            }}
          >
            {shown}
          </div>
          <div style={{fontFamily: T.display, fontSize: 88, color: T.red, textTransform: 'uppercase', marginTop: 4}}>{unit}</div>
        </Card>
        <div style={{height: 60}} />
        <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 44, lineHeight: 1.3, textAlign: 'center', opacity: useIn(30)}}>{caption}</div>
        {compare && (
          <div style={{marginTop: 50}}>
            <Sticker delay={84} rotate={3} bg={T.ink} color={T.yellow} size={42}>
              {compare.label}: {compare.value}
            </Sticker>
          </div>
        )}
      </AbsoluteFill>
      <div style={{position: 'absolute', right: 30, bottom: T.safeBottom + 10, transform: `rotate(6deg)`}}>
        <Mascot size={250} />
      </div>
      <Checker style={{position: 'absolute', bottom: T.safeBottom - 40, left: 0}} />
      <Footer delay={60} />
    </AbsoluteFill>
  );
};

export const DatoRapido: React.FC<DatoProps> = (props) => {
  const {hook} = DATO_SCENES;
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={hook + 6}>
        <Hook {...props} />
      </Sequence>
      <Sequence from={hook}>
        <Reveal {...props} />
      </Sequence>
      <Sequence from={hook - 8} durationInFrames={22}>
        <Wipe />
      </Sequence>
    </AbsoluteFill>
  );
};
