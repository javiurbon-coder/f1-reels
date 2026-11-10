// Voz + storyboard (diseño v2) + control de calidad para un guion ya verificado.
// Lo usan el orquestador diario y las correcciones desde el móvil.
import {speakAny, wordTimings} from './voice.mjs';
import {direct, toV2} from './director.mjs';
import {qa} from './qa.mjs';

const DRAWABLE = ['bars', 'stat']; // gráficas que el diseño v2 sabe dibujar

export async function produce({id, script, facts = [], noVoice = false, ctx = {}}) {
  const v = noVoice ? null : await speakAny(script, id);
  const seconds = v?.seconds ?? +(script.split(/\s+/).filter(Boolean).length / 2.6).toFixed(2);
  const words = v?.words ?? wordTimings(script, seconds);
  const d = direct({script, words, seconds, facts: facts.filter((f) => DRAWABLE.includes(f.scene?.type))});
  const scenes = toV2(d.scenes, ctx);
  const {problems, dataScenes} = qa({scenes, total: d.total});
  return {narration: v ? {file: v.file, seconds: +v.seconds.toFixed(2)} : undefined, words, scenes, total: d.total, engine: v?.engine ?? 'sin voz', problems, dataScenes};
}
