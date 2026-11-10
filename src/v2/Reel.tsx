// REEL v2: composición única del sistema diario. Recibe un storyboard (escenas con tiempos en segundos)
// y la voz con tiempos por palabra; cada escena usa el diseño de su tipo.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Wipe} from '../kit';
import {Dato, Fuentes, Mercado, Noticia, Portada, Resultado, Rumor, Tecnico} from './types';
import {EditCtx, SectionCtx, type Kind} from './ui';

type Word = {t: string; start: number; end: number};
type T0 = {from: number; to: number};
export type V2Scene = T0 &
  (
    | {type: 'hook'}
    | {type: 'sources'}
    | {type: 'list'; title?: string; rows: {icon: string; title: string; sub?: string; at?: number}[]}
    | {type: 'dato'; value: string; label: string; chartTitle?: string; maxPos?: number; rows: {name: string; grid: number; finish: number; color: string; me?: boolean; tag?: string}[]}
    | {type: 'mercado'; kindLabel: string; driver: string; team: string; teamColor: string; until: string}
    | {type: 'rumor'; who: string; n: number}
    | {type: 'tecnico'; title: string; parts: {n: number; name: string; sub: string; at?: number}[]}
    | {type: 'resultado'; gp: string; fastest?: string; podium: {name: string; team: string; color: string; gap: string}[]}
  );

export type ReelProps = {
  kind: Kind;
  headline: string;
  hl?: string;
  chip: string;
  /** Sección que se ve en grande al empezar (Técnica, Última hora, Rumor, Resumen del día…). */
  section?: string;
  date: string;
  sources: {name: string; domain: string; official?: boolean}[];
  scenes: V2Scene[];
  /** Palabras del guion con sus tiempos (siempre; con o sin voz). */
  words: Word[];
  narration?: {file: string; seconds: number};
  /** Etiquetas de la portada quitadas desde el editor (section, chip, date, intro, mascot, cta). */
  hide?: string[];
  /** Textos de la portada cambiados desde el editor (intro, cta). */
  txt?: Record<string, string>;
};

export const reelDuration = (p: Partial<ReelProps>, fps = 30) => Math.max(60, Math.ceil((p.scenes?.[p.scenes.length - 1]?.to ?? 5) * fps));

/** Trozos de 3-6 palabras (cortando en la puntuación) para la frase narrada de arriba. */
const chunksOf = (words: Word[]) => {
  const out: number[][] = [];
  let cur: number[] = [];
  words.forEach((w, i) => {
    cur.push(i);
    const end = /[.!?…]$/.test(w.t), soft = /[,;:]$/.test(w.t);
    if (end || cur.length >= 6 || (soft && cur.length >= 3)) { out.push(cur); cur = []; }
  });
  if (cur.length) out.push(cur);
  // un trozo final de 1 palabra se une al anterior
  if (out.length > 1 && out[out.length - 1].length === 1) out[out.length - 2].push(...out.pop()!);
  return out;
};

export const useCap = (words: Word[], offset: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chunks = React.useMemo(() => chunksOf(words), [words]);
  if (!words.length) return {cap: undefined, on: undefined};
  const now = frame / fps + offset;
  let i = 0;
  for (let k = 0; k < words.length; k++) if (words[k].start <= now + 0.04) i = k;
  const ch = chunks.find((c) => c.includes(i)) ?? chunks[0];
  return {cap: ch.map((k) => words[k].t).join(' '), on: ch.indexOf(i)};
};

const SceneV2: React.FC<{s: V2Scene; p: ReelProps}> = ({s, p}) => {
  const {fps} = useVideoConfig();
  const {cap, on} = useCap(p.words, s.from);
  const c = cap ?? '';
  switch (s.type) {
    case 'hook': return <Portada kind={p.kind} headline={p.headline} hl={p.hl} chip={p.chip} date={p.date} />;
    case 'list': return <Noticia cap={c} on={on} title={s.title} rows={s.rows.map((r) => ({...r, d: r.at !== undefined ? Math.max(8, Math.round(r.at * fps)) : undefined}))} />;
    case 'dato': return <Dato cap={c} on={on} value={s.value} label={s.label} chartTitle={s.chartTitle} maxPos={s.maxPos} rows={s.rows} />;
    case 'mercado': return <Mercado cap={c} on={on} kindLabel={s.kindLabel} driver={s.driver} team={s.team} teamColor={s.teamColor} until={s.until} />;
    case 'tecnico': return <Tecnico cap={c} on={on} title={s.title} parts={s.parts.map((x) => ({...x, d: Math.max(8, Math.round((x.at ?? 0.8) * fps))}))} />;
    case 'rumor': return <Rumor cap={c} on={on} who={s.who} n={s.n} />;
    case 'resultado': return <Resultado cap={c} on={on} gp={s.gp} podium={s.podium} fastest={s.fastest} />;
    default: return <Fuentes cap={c} on={on} sources={p.sources} />;
  }
};

export const Reel: React.FC<ReelProps> = (p) => {
  const {fps} = useVideoConfig();
  return (
    <SectionCtx.Provider value={p.section}>
    <EditCtx.Provider value={{hide: p.hide ?? [], txt: p.txt ?? {}}}>
    <AbsoluteFill>
      {p.narration && <Audio src={staticFile(p.narration.file)} />}
      {p.scenes.map((s, i) => {
        const from = Math.round(s.from * fps);
        return (
          <React.Fragment key={i}>
            <Sequence from={from} durationInFrames={Math.round((s.to - s.from) * fps) + (i < p.scenes.length - 1 ? 8 : 0)}>
              <SceneV2 s={s} p={p} />
            </Sequence>
            {i > 0 && <Sequence from={from - 8} durationInFrames={22}><Wipe /></Sequence>}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
    </EditCtx.Provider>
    </SectionCtx.Provider>
  );
};
