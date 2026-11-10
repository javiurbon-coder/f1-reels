// Reel de prueba con DATOS REALES contrastados (GP de São Paulo 2026).
// Fuentes: Formula1.com (crónica oficial), Sky Sports (resultado y diferencia), Wikipedia/F1.com (2024), beIN/Emol (2025).
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {Wipe} from '../kit';
import {Dato, Fuentes, Portada, Resultado} from './types';

const S = [90, 150, 195, 120];
export const VER_TOTAL = S.reduce((a, b) => a + b, 0);
const useWord = (cap: string, dur: number) => Math.max(0, Math.min(cap.split(' ').length - 1, Math.floor((useCurrentFrame() - 6) / ((dur - 30) / cap.split(' ').length))));
const RB = '#3671c6';

const A: React.FC = () => {
  const cap = 'Norris ganó, pero el protagonista fue Verstappen';
  return <Resultado cap={cap} on={useWord(cap, S[1])} gp="GP de São Paulo · Interlagos" podium={[
    {name: 'Norris', team: 'McLaren', color: '#ff8000', gap: 'Ganador'}, {name: 'Verstappen', team: 'Red Bull', color: RB, gap: '+14.6 s'}, {name: 'Hadjar', team: 'Red Bull', color: RB, gap: ''}]} />;
};
const B: React.FC = () => {
  const cap = 'Y no es la primera vez que remonta en Brasil';
  return <Dato cap={cap} on={useWord(cap, S[2])} value="+19" label="posiciones ganadas: de 21º a 2º" chartTitle="Verstappen en Interlagos" maxPos={22} rows={[
    {name: '2024', grid: 17, finish: 1, color: RB, tag: '1º'},
    {name: '2025 · boxes', grid: 20, finish: 3, color: RB, tag: '3º'},
    {name: '2026', grid: 21, finish: 2, color: RB, me: true, tag: '2º'}]} />;
};
const C: React.FC = () => {
  const cap = 'Lo cuentan tres medios distintos';
  return <Fuentes cap={cap} on={useWord(cap, S[3])} sources={[
    {name: 'Formula1.com', domain: 'formula1.com', official: true}, {name: 'Sky Sports', domain: 'skysports.com'}, {name: 'ESPN', domain: 'espn.com'}]} />;
};

export const Verstappen: React.FC = () => {
  const starts = S.map((_, i) => S.slice(0, i).reduce((a, b) => a + b, 0));
  const scenes = [<Portada kind="dato" headline="Verstappen: de 21º a 2º en Brasil" hl="VERSTAPPEN" chip="3 fuentes" date="8 NOV" />, <A />, <B />, <C />];
  return (
    <AbsoluteFill>
      {scenes.map((el, i) => (
        <React.Fragment key={i}>
          <Sequence from={starts[i]} durationInFrames={S[i] + (i < 3 ? 8 : 0)}>{el}</Sequence>
          {i > 0 && <Sequence from={starts[i] - 8} durationInFrames={22}><Wipe /></Sequence>}
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};
