// Genera el REEL DE PRESENTACIÓN de la cuenta (voz + vídeo) y, si Telegram está configurado, te lo envía.
// Uso: npm run presentacion   (en la nube: Actions → "Reel de presentación" → Run workflow)
import fs from 'node:fs';
import {speakAny, wordTimings, voiceErrors} from './agents/lib/voice.mjs';
import {renderVideo} from './lib/render.mjs';

// Un bloque por escena (7). Cada pantalla entra justo cuando la voz empieza su bloque, así que lo que se ve coincide con lo que se oye.
export const BLOCKS = [
  '¿Harto de rumores de F1 que luego no son verdad?',
  'Esto es Contrastado F1: noticias, fichajes y resultados, explicados en menos de un minuto.',
  'Nuestra regla es simple: si no lo confirman al menos dos fuentes, no lo damos como noticia. Y si es un rumor, te lo avisamos.',
  'Además, ponemos cada noticia en contexto con datos reales. Por ejemplo:',
  'Verstappen ha subido al podio de Interlagos tres años seguidos, saliendo desde la parte de atrás de la parrilla.',
  'Y también te explicamos cómo funciona un Fórmula 1 por dentro, de forma sencilla.',
  'Síguenos para no perderte nada. Las fuentes, siempre en la descripción.',
];
export const CAPTION = `Bienvenido a CONTRASTADO F1 🏁\n\nNoticias de Fórmula 1 con una regla: si no lo confirman al menos dos fuentes, no es noticia. Los rumores, siempre avisados. Y las fuentes, en la descripción.\n\nDato de Verstappen en Interlagos (2024-2026): Sky Sports (2024), Sports Illustrated (2025), Motorsport.com y PlanetF1 (2026).\n\nLa voz de este vídeo está generada con IA.\n\nSíguenos para no perderte nada.\n\n#F1 #Formula1 #FormulaUno #F1España #NoticiasF1`;

export function plan(words, seconds) {
  let i = 0;
  const cuts = BLOCKS.map((b, k) => { const t = k === 0 ? 0 : Math.max(0, words[i].start - 0.15); i += b.split(/\s+/).length; return +t.toFixed(2); });
  return {cuts, total: +(seconds + 1.5).toFixed(2), words};
}

if (process.argv[1].endsWith('presentacion.mjs')) {
  const script = BLOCKS.join(' ');
  const v = process.argv.includes('--no-voice') ? null : await speakAny(script, 'presentacion');
  const seconds = v?.seconds ?? script.split(/\s+/).length / 2.6;
  const props = {...plan(v?.words ?? wordTimings(script, seconds), seconds), ...(v ? {narration: {file: v.file, seconds: v.seconds}} : {})};
  fs.mkdirSync('out', {recursive: true});
  await renderVideo({id: 'Presentacion', props, out: 'out/presentacion.mp4'});
  console.log(`OK → out/presentacion.mp4 (${props.total.toFixed(0)} s, voz: ${v?.engine ?? 'sin voz'})`);
  const {configured, sendVideo, say} = await import('./bot/tg.mjs');
  if (configured()) { await sendVideo('out/presentacion.mp4', `🎬 REEL DE PRESENTACIÓN\n🎙 Voz: ${v?.engine ?? 'sin voz'}${voiceErrors.length ? '\n⚠️ ' + voiceErrors.join('\n⚠️ ') : ''}`); await say(CAPTION); }
}
