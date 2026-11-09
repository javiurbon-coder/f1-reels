import React from 'react';
import {AbsoluteFill, Sequence, interpolate, useCurrentFrame} from 'remotion';
import './fonts';
import {Backdrop, Card, Checker, Footer, Headline, Header, Mascot, Sticker, Wipe, useBob, useIn} from './kit';
import {theme as T} from './theme';

export type Driver = {pos: number; driver: string; team: string; color: string; time: string};
export type ResultsProps = {
  race: string;
  circuit: string;
  date: string;
  podium: Driver[];
  rest: Driver[];
  fastestLap?: {driver: string; time: string};
};

// Duración de cada escena (frames a 30 fps)
export const RESULTS_SCENES = {hook: 84, podium: 150, rest: 126};
export const RESULTS_TOTAL = RESULTS_SCENES.hook + RESULTS_SCENES.podium + RESULTS_SCENES.rest;

/* ---- Escena 1: gancho ---- */
const Hook: React.FC<ResultsProps> = ({race, circuit, date}) => {
  const bob = useBob(10, 0.12);
  const p = useIn(30);
  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <Header tag="Resultados" dark />
      <AbsoluteFill style={{padding: `${T.safeTop + 170}px ${T.safeX}px 0`}}>
        <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 38, letterSpacing: 4, color: T.yellow, marginBottom: 24}}>
          {date.toUpperCase()}
        </div>
        <Headline text={race} size={150} delay={4} hl={[race.split(' ')[0]]} color={T.white} />
        <div style={{height: 36}} />
        <Sticker delay={34} rotate={-3} size={44} bg={T.white}>
          {circuit}
        </Sticker>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          right: 20,
          bottom: T.safeBottom + 40,
          transform: `translateY(${bob}px) rotate(${interpolate(p, [0, 1], [20, -8])}deg) scale(${p})`,
        }}
      >
        <Mascot size={420} mood="wow" />
      </div>
      <Checker style={{position: 'absolute', bottom: T.safeBottom - 40, left: 0, width: '60%'}} />
    </AbsoluteFill>
  );
};

/* ---- Escena 2: podio ---- */
const PodiumCard: React.FC<{d: Driver; i: number}> = ({d, i}) => {
  const medal = [T.yellow, '#d9d9d9', '#e2995a'][i];
  const rot = [-1.2, 0.8, -0.6][i];
  return (
    <Card delay={16 + i * 22} rotate={rot} style={{height: 392, display: 'flex', overflow: 'hidden', marginBottom: 44}}>
      <div style={{width: 24, background: d.color, borderRight: `${T.border}px solid ${T.ink}`}} />
      <div
        style={{
          width: 230,
          background: medal,
          borderRight: `${T.border}px solid ${T.ink}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: T.display,
          fontSize: 250,
          color: T.ink,
        }}
      >
        {d.pos}
      </div>
      <div style={{flex: 1, padding: '34px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
        <div>
          <div style={{fontFamily: T.display, fontSize: 96, lineHeight: 1, textTransform: 'uppercase'}}>{d.driver}</div>
          <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 38, color: T.muted, marginTop: 12}}>{d.team}</div>
        </div>
        <div style={{fontFamily: T.display, fontSize: 66, color: T.ink}}>
          <span style={{background: T.yellow, padding: '0 14px', border: `4px solid ${T.ink}`}}>{d.time}</span>
        </div>
      </div>
    </Card>
  );
};

const Podium: React.FC<ResultsProps> = ({podium}) => (
  <AbsoluteFill>
    <Backdrop variant="cream" />
    <Header tag="Podio" />
    <AbsoluteFill style={{padding: `${T.safeTop + 150}px ${T.safeX}px 0`}}>
      {podium.map((d, i) => (
        <PodiumCard key={d.pos} d={d} i={i} />
      ))}
    </AbsoluteFill>
    <Footer delay={70} />
  </AbsoluteFill>
);

/* ---- Escena 3: resto + vuelta rápida ---- */
const Row: React.FC<{d: Driver; i: number}> = ({d, i}) => (
  <Card delay={8 + i * 6} style={{height: 142, display: 'flex', alignItems: 'center', marginBottom: 26, overflow: 'hidden', borderRadius: 20}}>
    <div style={{width: 18, alignSelf: 'stretch', background: d.color, borderRight: `5px solid ${T.ink}`}} />
    <div style={{width: 130, fontFamily: T.display, fontSize: 76, textAlign: 'center'}}>{d.pos}</div>
    <div style={{flex: 1, fontFamily: T.display, fontSize: 60, textTransform: 'uppercase'}}>{d.driver}</div>
    <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 40, paddingRight: 32}}>{d.time}</div>
  </Card>
);

const Rest: React.FC<ResultsProps> = ({rest, fastestLap}) => (
  <AbsoluteFill>
    <Backdrop variant="yellow" />
    <Header tag="Top 10" />
    <AbsoluteFill style={{padding: `${T.safeTop + 170}px ${T.safeX}px 0`}}>
      {rest.map((d, i) => (
        <Row key={d.pos} d={d} i={i} />
      ))}
      {fastestLap && (
        <div style={{marginTop: 26}}>
          <Sticker delay={60} rotate={-2} bg="#b061ff" color={T.white} size={38}>
            Vuelta rápida · {fastestLap.driver} · {fastestLap.time}
          </Sticker>
        </div>
      )}
    </AbsoluteFill>
    <div style={{position: 'absolute', right: 40, bottom: T.safeBottom + 10, transform: 'rotate(-8deg)'}}>
      <Mascot size={300} />
    </div>
    <Footer delay={50} />
  </AbsoluteFill>
);

export const ResultsReel: React.FC<ResultsProps> = (props) => {
  const {hook, podium} = RESULTS_SCENES;
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={hook + 6}>
        <Hook {...props} />
      </Sequence>
      <Sequence from={hook} durationInFrames={podium + 6}>
        <Podium {...props} />
      </Sequence>
      <Sequence from={hook + podium}>
        <Rest {...props} />
      </Sequence>
      {/* transiciones */}
      <Sequence from={hook - 8} durationInFrames={22}>
        <Wipe />
      </Sequence>
      <Sequence from={hook + podium - 8} durationInFrames={22}>
        <Wipe />
      </Sequence>
    </AbsoluteFill>
  );
};
