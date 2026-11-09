import React from 'react';
import {AbsoluteFill, Sequence, interpolate} from 'remotion';
import './fonts';
import {Backdrop, Card, Footer, Headline, Header, Mascot, Sticker, Wipe, useBob, useIn} from './kit';
import {NoticiaProps, Voice, withVoice} from './NoticiaVerificada';
import {theme as T} from './theme';

export type SemanaProps = {
  gp: string; // "GP de Brasil"
  circuit: string;
  dates: string; // "7-9 NOV"
  /** Horas ya convertidas a Europe/Madrid. Máx. 6 sesiones. */
  sessions: {day: string; name: string; time: string}[];
  narration?: NoticiaProps['narration'];
};

export const SEMANA_SCENES = {hook: 90, schedule: 180};
export const SEMANA_TOTAL = SEMANA_SCENES.hook + SEMANA_SCENES.schedule;
export const semanaDuration = (p: Partial<SemanaProps>) => withVoice(SEMANA_TOTAL, p.narration);

const gpSize = (s: string) => (s.length < 14 ? 170 : s.length < 22 ? 130 : 100);

const Hook: React.FC<SemanaProps> = ({gp, circuit, dates}) => {
  const bob = useBob(10, 0.11);
  const p = useIn(26);
  return (
    <AbsoluteFill>
      <Backdrop variant="yellow" />
      <Header tag="Esta semana" />
      <AbsoluteFill style={{padding: `${T.safeTop + 200}px ${T.safeX}px 0`}}>
        <Sticker delay={4} rotate={-3} size={38} bg={T.ink} color={T.yellow}>{dates}</Sticker>
        <div style={{height: 30}} />
        <Headline text={gp} size={gpSize(gp)} delay={6} hl={[gp.split(' ').pop() as string]} />
        <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 38, marginTop: 26, letterSpacing: 2}}>{circuit}</div>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 40, bottom: T.safeBottom + 30, transform: `translateY(${bob}px) rotate(${interpolate(p, [0, 1], [-25, 7])}deg) scale(${p})`}}>
        <Mascot size={380} />
      </div>
    </AbsoluteFill>
  );
};

const Schedule: React.FC<SemanaProps> = ({sessions}) => (
  <AbsoluteFill>
    <Backdrop variant="cream" />
    <Header tag="Horarios · España" />
    <AbsoluteFill style={{padding: `${T.safeTop + 160}px ${T.safeX}px 0`}}>
      <div style={{marginBottom: 30}}><Headline text="Cuándo se corre" size={92} delay={0} hl={['corre']} /></div>
      {sessions.slice(0, 6).map((s, i) => (
        <Card key={i} delay={12 + i * 10} rotate={i % 2 ? 0.7 : -0.7} style={{height: 128, display: 'flex', alignItems: 'center', gap: 24, padding: '0 28px', marginBottom: 22, borderRadius: 22}}>
          <div style={{fontFamily: T.display, fontSize: 46, width: 110, background: T.yellow, border: `4px solid ${T.ink}`, textAlign: 'center', padding: '4px 0', textTransform: 'uppercase'}}>{s.day}</div>
          <div style={{flex: 1, minWidth: 0, fontFamily: T.display, fontSize: 44, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.name}</div>
          <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 44}}>{s.time}</div>
        </Card>
      ))}
    </AbsoluteFill>
    <Footer delay={60} />
  </AbsoluteFill>
);

export const EstaSemana: React.FC<SemanaProps> = (props) => {
  const {hook} = SEMANA_SCENES;
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={hook + 6}><Hook {...props} /></Sequence>
      <Sequence from={hook}><Schedule {...props} /></Sequence>
      <Sequence from={hook - 8} durationInFrames={22}><Wipe /></Sequence>
      <Voice narration={props.narration} />
    </AbsoluteFill>
  );
};
