// Agente "locutor". Motores, por orden de preferencia (el primero disponible; si falla, el siguiente):
//   1) ElevenLabs  → si existe ELEVENLABS_API_KEY (la mejor voz; da tiempos exactos por palabra)
//   2) Edge neural → gratis, sin clave (pip install edge-tts), voces naturales en español
//   3) Piper       → gratis y local, voz más robótica (último recurso)
// Forzar uno: VOICE_ENGINE=eleven|edge|piper|none
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';

const PIPER = process.env.PIPER_BIN || 'piper';
const VOICE = process.env.PIPER_VOICE || 'voices/es_ES-davefx-medium.onnx';
const EDGE_VOICE = process.env.EDGE_VOICE || 'es-ES-AlvaroNeural';
const EDGE_RATE = process.env.EDGE_RATE || '+4%';

export const piperAvailable = () => spawnSync(PIPER, ['--help'], {stdio: 'ignore'}).status === 0 && fs.existsSync(VOICE);
const edgeCmd = () => {
  for (const c of [['edge-tts'], ['python3', '-m', 'edge_tts'], ['python', '-m', 'edge_tts']]) {
    if (spawnSync(c[0], [...c.slice(1), '--help'], {stdio: 'ignore'}).status === 0) return c;
  }
  return null;
};
export const elevenAvailable = () => !!process.env.ELEVENLABS_API_KEY;

export function wavSeconds(file) {
  const b = fs.readFileSync(file);
  const rate = b.readUInt32LE(24), bytesPerSec = b.readUInt32LE(28);
  const dataAt = b.indexOf('data');
  return b.readUInt32LE(dataAt + 4) / (bytesPerSec || rate * 2);
}

/** Duración de un audio: ffprobe si existe; si no, estimación por tamaño (mp3 de Edge ≈ 48 kbps). */
export function audioSeconds(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'});
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) && d > 0 ? d : fs.statSync(file).size * 8 / 48000;
}

export function speak(text, out) { // Piper (síncrono, se conserva por compatibilidad)
  const r = spawnSync(PIPER, ['--model', VOICE, '--output_file', out], {input: text, encoding: 'utf8'});
  if (r.status !== 0) throw new Error('Piper falló: ' + r.stderr);
  return wavSeconds(out);
}

/** Reparte la duración del audio entre las palabras según su longitud (aprox. suficiente para subtítulos). */
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

/** Tiempos exactos por palabra a partir de la alineación por carácter de ElevenLabs. */
export function wordsFromAlignment(text, al) {
  const out = [];
  let cur = '', st = 0, en = 0;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push({t: cur.replace(/[¡¿]/g, ''), start: +st.toFixed(3), end: +en.toFixed(3)});
      cur = '';
    } else {
      if (!cur) st = al.character_start_times_seconds[i];
      cur += ch;
      en = al.character_end_times_seconds[i];
    }
  });
  if (cur) out.push({t: cur.replace(/[¡¿]/g, ''), start: +st.toFixed(3), end: +en.toFixed(3)});
  return out.length === text.split(/\s+/).filter(Boolean).length ? out : null;
}

async function eleven(text, out) {
  const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json'},
    body: JSON.stringify({text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'}),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  fs.writeFileSync(out, Buffer.from(j.audio_base64, 'base64'));
  const seconds = audioSeconds(out);
  return {seconds, words: j.alignment ? wordsFromAlignment(text, j.alignment) : null};
}

function edge(text, out) {
  const cmd = edgeCmd();
  if (!cmd) throw new Error('edge-tts no instalado');
  const tmp = out + '.txt';
  fs.writeFileSync(tmp, text);
  const r = spawnSync(cmd[0], [...cmd.slice(1), '--voice', EDGE_VOICE, `--rate=${EDGE_RATE}`, '--file', tmp, '--write-media', out], {encoding: 'utf8', timeout: 120000});
  fs.rmSync(tmp, {force: true});
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error('edge-tts falló: ' + (r.stderr || '').slice(0, 160));
  return {seconds: audioSeconds(out), words: null};
}

export const voiceEngines = () => {
  const forced = process.env.VOICE_ENGINE;
  if (forced === 'none') return [];
  const all = [];
  if (elevenAvailable() && (!forced || forced === 'eleven')) all.push('eleven');
  if (!forced || forced === 'edge') if (edgeCmd()) all.push('edge');
  if (!forced || forced === 'piper') if (piperAvailable()) all.push('piper');
  return all;
};

/** Motivos por los que algún motor falló en esta ejecución (para avisarte por Telegram). */
export const voiceErrors = [];

/** Genera la voz de `text`. Devuelve {file (relativo a public/), seconds, words, engine} o null si no hay ningún motor. */
export async function speakAny(text, id) {
  fs.mkdirSync('public/audio', {recursive: true});
  for (const engine of voiceEngines()) {
    try {
      const ext = engine === 'piper' ? 'wav' : 'mp3';
      const out = `public/audio/${id}.${ext}`;
      let r;
      if (engine === 'eleven') r = await eleven(text, out);
      else if (engine === 'edge') r = edge(text, out);
      else r = {seconds: speak(text, out), words: null};
      return {file: `audio/${id}.${ext}`, seconds: r.seconds, words: r.words ?? wordTimings(text, r.seconds), engine};
    } catch (e) { voiceErrors.push(`${engine}: ${e.message}`); console.log(`  · voz ${engine} falló (${e.message}); pruebo la siguiente`); }
  }
  return null;
}
