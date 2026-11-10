// REEL DE PRESENTACIÓN de la cuenta. Seis bloques; `cuts` = segundo en que empieza cada uno (lo calcula scripts/presentacion.mjs con la voz).
// El único dato que aparece (Verstappen en Interlagos 2024-2026) está contrastado: Formula1.com, Sky Sports, beIN.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Wipe} from '../kit';
import {Cierre, Dato, Noticia, Portada, Tecnico} from './types';
import {useCap} from './Reel';

type Word = {t: string; start: number; end: number};
export type PresProps = {cuts: number[]; total: number; words: Word[]; narration?: {file: string; seconds: number}};
export const presDuration = (p: Partial<PresProps>, fps = 30) => Math.ceil((p.total ?? 36) * fps);
const RB = '#3671c6';

const Block: React.FC<{k: number; p: PresProps}> = ({k, p}) => {
  const {cap, on} = useCap(p.words, p.cuts[k]);
  const c = cap ?? '';
  switch (k) {
    case 0: return <Portada kind="intro" headline="¿Harto de rumores de F1 que no son verdad?" hl="rumores" chip="Nuevo" date="PRESENTACIÓN" />;
    case 1: return <Noticia kind="menu" cap={c} on={on} title="Qué vas a ver" rows={[
      {icon: 'flag', title: 'Noticias contrastadas', sub: 'Última hora, sin humo', d: 14}, {icon: 'doc', title: 'Fichajes y mercado', sub: 'Quién firma y hasta cuándo', d: 30},
      {icon: 'trophy', title: 'Resultados de cada GP', sub: 'Podio y claves de la carrera', d: 46}, {icon: 'stopwatch', title: 'Menos de un minuto', sub: 'Directo al grano', d: 62}]} />;
    case 2: return <Noticia kind="reglas" cap={c} on={on} title="Nuestras reglas" rows={[
      {icon: 'flag', title: 'Mínimo dos fuentes', sub: 'O una fuente oficial', d: 14}, {icon: 'eye', title: 'Rumor = te avisamos', sub: 'Nunca lo vendemos como hecho', d: 60},
      {icon: 'chart', title: 'Cifras comprobadas', sub: 'Si no cuadra, no sale', d: 90}]} />;
    case 3: return <Dato cap={c} on={on} value="3" label="años seguidos remontando en Brasil" chartTitle="Verstappen en Interlagos" maxPos={22} rows={[
      {name: '2024', grid: 17, finish: 1, color: RB, tag: '1º'}, {name: '2025 · boxes', grid: 20, finish: 3, color: RB, tag: '3º'}, {name: '2026', grid: 21, finish: 2, color: RB, me: true, tag: '2º'}]} />;
    case 4: return <Tecnico cap={c} on={on} title="El efecto suelo" parts={[
      {n: 1, name: 'Alerón delantero', sub: 'Ordena el aire que llega al coche'}, {n: 2, name: 'Suelo', sub: 'Aire rápido debajo = baja presión'}, {n: 3, name: 'Alerón trasero', sub: 'Empuja el eje trasero hacia abajo'}]} />;
    default: return <Cierre cap={c} on={on} />;
  }
};

export const Presentacion: React.FC<PresProps> = (p) => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill>
      {p.narration && <Audio src={staticFile(p.narration.file)} />}
      {p.cuts.map((t, k) => {
        const from = Math.round(t * fps), to = Math.round((p.cuts[k + 1] ?? p.total) * fps);
        return (
          <React.Fragment key={k}>
            <Sequence from={from} durationInFrames={to - from + (k < p.cuts.length - 1 ? 8 : 0)}><Block k={k} p={p} /></Sequence>
            {k > 0 && <Sequence from={from - 8} durationInFrames={22}><Wipe /></Sequence>}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
