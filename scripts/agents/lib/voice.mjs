// Agente "locutor": Piper TTS local (gratis, offline). Devuelve WAV + tiempos por palabra.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';

const PIPER = process.env.PIPER_BIN || 'piper';
const VOICE = process.env.PIPER_VOICE || 'voices/es_ES-davefx-medium.onnx';

export const piperAvailable = () => spawnSync(PIPER, ['--help'], {stdio: 'ignore'}).status === 0 && fs.existsSync(VOICE);

export function wavSeconds(file) {
  const b = fs.readFileSync(file);
  const rate = b.readUInt32LE(24), bytesPerSec = b.readUInt32LE(28);
  const dataAt = b.indexOf('data');
  return b.readUInt32LE(dataAt + 4) / (bytesPerSec || rate * 2);
}

export function speak(text, out) {
  const r = spawnSync(PIPER, ['--model', VOICE, '--output_file', out], {input: text, encoding: 'utf8'});
  if (r.status !== 0) throw new Error('Piper falló: ' + r.stderr);
  return wavSeconds(out);
}

/** Reparte la duración del audio entre las palabras según su longitud (aprox. suficiente para subtítulos; sin Whisper). */
export function wordTimings(text, seconds, lead = 0.15) {
  const words = text.split(/\s+/).filter(Boolean);
  const weight = (w) => w.length + (/[.,;:!?]$/.test(w) ? 4 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0);
  const span = Math.max(0.1, seconds - lead);
  let t = lead;
  return words.map((w) => {
    const d = (weight(w) / total) * span;
    const o = {t: w.replace(/[¡¿]/g, ''), start: +t.toFixed(3), end: +(t + d).toFixed(3)};
    t += d;
    return o;
  });
}
