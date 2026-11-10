// Vídeo de prueba del diseño v2 (sin voz todavía; los datos son DE EJEMPLO).
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {Wipe} from '../kit';
import {Fuentes, Mercado, Noticia, Portada} from './types';

const S = [90, 150, 150, 120]; // duración de cada escena en frames
export const DEMO_TOTAL = S.reduce((a, b) => a + b, 0);

/** Índice de la palabra "que suena" según avanza la escena (simula la voz). */
const useWord = (cap: string, dur: number) => {
  const f = useCurrentFrame();
  const n = cap.split(' ').length;
  return Math.min(n - 1, Math.floor((f - 6) / ((dur - 30) / n)));
};

const A: React.FC = () => {
  const cap = 'El acuerdo incluye dos años más de contrato';
  return <Noticia cap={cap} on={Math.max(0, useWord(cap, S[1]))} rows={[
    {icon: 'doc', title: 'Renueva dos años', sub: 'Contrato hasta final de 2028'},
    {icon: 'calendar', title: 'Anuncio oficial hoy', sub: 'Comunicado del equipo'},
    {icon: 'wrench', title: 'Nuevo motor en 2026', sub: 'Cambio de reglamento'},
    {icon: 'trophy', title: 'Objetivo: el podio', sub: 'Lo dice el propio piloto'}]} />;
};
const B: React.FC = () => {
  const cap = 'Alonso seguirá de verde dos temporadas más';
  return <Mercado cap={cap} on={Math.max(0, useWord(cap, S[2]))} kindLabel="RENOVACIÓN" driver="Alonso" team="Aston Martin" teamColor="#2fb38a" until="2028" />;
};
const C: React.FC = () => {
  const cap = 'Lo cuentan tres medios distintos';
  return <Fuentes cap={cap} on={Math.max(0, useWord(cap, S[3]))} sources={[
    {name: 'Formula1.com', domain: 'formula1.com', official: true}, {name: 'Motorsport.com', domain: 'es.motorsport.com'}, {name: 'Diario AS', domain: 'as.com'}]} />;
};

export const Demo: React.FC = () => {
  const starts = S.map((_, i) => S.slice(0, i).reduce((a, b) => a + b, 0));
  const scenes = [<Portada headline="Alonso renueva con Aston Martin hasta 2028" hl="ALONSO" chip="3 fuentes" date="10 NOV" />, <A />, <B />, <C />];
  return (
    <AbsoluteFill>
      {scenes.map((el, i) => (
        <React.Fragment key={i}>
          <Sequence from={starts[i]} durationInFrames={S[i] + (i < 3 ? 8 : 0)}>{el}</Sequence>
          {i > 0 && <Sequence from={starts[i] - 8} durationInFrames={22}><Wipe /></Sequence>}
        </React.Fragment>
      ))}
      <div style={{position: 'absolute', top: 40, left: 0, width: 1080, textAlign: 'center', fontFamily: 'Arial', fontWeight: 700, fontSize: 26, color: 'rgba(0,0,0,0.55)'}}>MAQUETA · DATOS DE EJEMPLO, NO REALES</div>
    </AbsoluteFill>
  );
};
