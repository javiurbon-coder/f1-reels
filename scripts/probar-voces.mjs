// Genera una muestra con TODAS las voces gratuitas de Edge en español de España y te las manda a Telegram,
// para que elijas la que más te guste. Uso: Actions → "Probar voces gratis" → Run workflow.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {configured, call, CHAT, say} from './bot/tg.mjs';

const TEXTO = 'Esto es Contrastado F1: noticias, fichajes y resultados, explicados en menos de un minuto. Verstappen salió decimotercero y acabó segundo.';
const PREFIJO = process.env.VOCES_PREFIJO || 'es-ES';
const cmd = [['edge-tts'], ['python3', '-m', 'edge_tts']].find(c => spawnSync(c[0], [...c.slice(1), '--version']).status === 0);
if (!cmd) throw new Error('edge-tts no está instalado');

const lista = spawnSync(cmd[0], [...cmd.slice(1), '--list-voices'], {encoding: 'utf8'}).stdout || '';
const voces = lista.split('\n').map(l => l.trim().split(/\s+/)).filter(p => p[0]?.startsWith(PREFIJO)).map(p => ({name: p[0], gender: p[1]}));
console.log(`${voces.length} voces ${PREFIJO}`);
if (configured()) await say(`🎙 Probando ${voces.length} voces gratis (${PREFIJO}). Te llegan ahora; apunta el nombre de la que te guste.`);

fs.mkdirSync('out/voces', {recursive: true});
for (const v of voces) {
  const out = `out/voces/${v.name}.mp3`;
  const r = spawnSync(cmd[0], [...cmd.slice(1), '--voice', v.name, '--rate=+4%', '--text', TEXTO, '--write-media', out], {encoding: 'utf8', timeout: 60000});
  if (r.status !== 0 || !fs.existsSync(out)) { console.log(`✗ ${v.name}`); continue; }
  console.log(`✓ ${v.name}`);
  if (!configured()) continue;
  const f = new FormData();
  f.append('chat_id', CHAT);
  f.append('caption', `${v.name} (${v.gender})`);
  f.append('title', v.name);
  f.append('audio', new Blob([fs.readFileSync(out)], {type: 'audio/mpeg'}), `${v.name}.mp3`);
  try { await call('sendAudio', null, f); } catch (e) { console.log('Telegram:', e.message); }
}
if (configured()) await say('✅ Fin. Dime el nombre de la voz que prefieras y la dejo puesta.');
