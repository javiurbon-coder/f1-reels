// REEL DE PRESENTACIÓN de la cuenta. Siete bloques (el dato de Verstappen entra justo cuando la voz dice su nombre); `cuts` = segundo en que empieza cada uno (lo calcula scripts/presentacion.mjs con la voz).
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

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const Block: React.FC<{k: number; p: PresProps}> = ({k, p}) => {
  const {fps} = useVideoConfig();
  const {cap, on} = useCap(p.words, p.cuts[k]);
  const c = cap ?? '';
  // cada fila aparece EXACTAMENTE cuando la voz dice su palabra clave (frames desde el inicio del bloque)
  const at = (kw: string): number | undefined => {
    const from = p.cuts[k], to = p.cuts[k + 1] ?? p.total;
    const w = p.words.find((x) => x.start >= from - 0.05 && x.start < to && norm(x.t).startsWith(norm(kw)));
    return w ? Math.max(6, Math.round((w.start - from) * fps)) : undefined;
  };
  switch (k) {
    case 0: return <Portada kind="intro" headline="¿Harto de rumores de F1 que luego no son verdad?" hl="rumores" chip="Nuevo" date="PRESENTACIÓN" />;
    case 1: return <Noticia kind="menu" cap={c} on={on} title="Qué vas a ver" rows={[
      {icon: 'flag', title: 'Noticias contrastadas', sub: 'Última hora, sin humo', d: at('noticias')}, {icon: 'doc', title: 'Fichajes y mercado', sub: 'Quién firma y hasta cuándo', d: at('fichajes')},
      {icon: 'trophy', title: 'Resultados de cada GP', sub: 'Podio y claves de la carrera', d: at('resultados')}, {icon: 'stopwatch', title: 'Menos de un minuto', sub: 'Directo al grano', d: at('menos')}]} />;
    case 2: return <Noticia kind="reglas" cap={c} on={on} title="Nuestras reglas" rows={[
      {icon: 'flag', title: 'Mínimo dos fuentes', sub: 'O una fuente oficial', d: at('dos')}, {icon: 'doc', title: 'Si no, no es noticia', sub: 'No la damos como hecho', d: at('noticia')},
      {icon: 'eye', title: 'Rumor = te avisamos', sub: 'Siempre bien señalado', d: at('rumor')}]} />;
    case 3: return <Noticia kind="menu" cap={c} on={on} title="Con contexto" rows={[
      {icon: 'doc', title: 'Cada noticia, en contexto', sub: 'Qué hay detrás', d: at('contexto')}, {icon: 'chart', title: 'Datos reales', sub: 'Cifras de fuentes oficiales', d: at('datos')}]} />;
    case 4: return <Dato cap={c} on={on} value="3" label="años seguidos de podio en Interlagos" chartTitle="Verstappen en Interlagos" maxPos={22} rows={[
      {name: '2024', grid: 17, finish: 1, color: RB, tag: '1º'}, {name: '2025 · boxes', grid: 20, finish: 3, color: RB, tag: '3º'}, {name: '2026', grid: 21, finish: 2, color: RB, me: true, tag: '2º'}]} />;
    case 5: return <Tecnico cap={c} on={on} title="Un F1 por dentro" parts={[
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
