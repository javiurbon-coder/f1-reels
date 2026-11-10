// Trabajo pesado: rehace los vídeos que corregiste desde el móvil y los vuelve a enviar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderVideo} from '../lib/render.mjs';
import {produce} from '../agents/lib/produce.mjs';
import {say, sendVideo, configured} from './tg.mjs';
import {load, save} from './state.mjs';

if (!configured()) process.exit(0);
const state = load();
for (const it of Object.values(state.items).filter((i) => i.status === 'edit')) {
  try {
    const props = {...it.props};
    if (it.edit?.headline) props.headline = it.edit.headline;
    const script = it.edit?.script ?? (it.edit?.headline ? `${it.edit.headline}.` : it.script);
    if (script && it.composition === 'Reel') {
      // se conservan las escenas propias (mercado/rumor/datos) del vídeo original y se rehace el resto con el guion nuevo
      const keep = (props.scenes ?? []).find((x) => x.type === 'mercado' || x.type === 'rumor');
      const ctx = keep?.type === 'mercado' ? {market: (({from, to, type, ...m}) => m)(keep)} : keep?.type === 'rumor' ? {rumor: (({from, to, type, ...m}) => m)(keep)} : {};
      const prod = await produce({id: it.id, script, ctx});
      props.scenes = prod.scenes; props.words = prod.words;
      if (prod.narration) props.narration = prod.narration; else delete props.narration;
    }
    const out = path.join(os.tmpdir(), `${it.id}.mp4`);
    await renderVideo({id: it.composition, props, out});
    const caption = it.edit?.headline ? it.caption.replace(/^.*\n/, `${it.edit.headline}\n`) : it.caption;
    const {msgId, fileId} = await sendVideo(out, `✏️ CORREGIDO · ${props.headline ?? it.id}`, it.id);
    Object.assign(it, {props, script, caption, msgId, fileId, status: 'sent', edit: undefined});
    await say(caption);
  } catch (e) {
    it.status = 'sent'; delete it.edit;
    await say(`✗ No pude rehacer el vídeo ${it.id}: ${e.message}`);
  }
}
save(state);

// Reels elegidos en el menú del día: se hace SOLO el que pulsaste (guion → voz → render → Telegram).
import {spawnSync} from 'node:child_process';
const st = load();
const picks = st.picks ?? [], topicPicks = st.topicPicks ?? [], sumPicks = st.sumPicks ?? [], hoy = !!st.hoy;
st.picks = []; st.topicPicks = []; st.sumPicks = []; st.hoy = false;
save(st);
for (const id of picks) {
  const c = st.menuClusters?.[id];
  if (!c) { await say(`✗ No encuentro la noticia ${id} (caducó). Pide otro menú con 🔁.`); continue; }
  await say(`🎞 Montando el vídeo: ${c.headline}`);
  fs.mkdirSync('data/news', {recursive: true});
  fs.writeFileSync('data/news/clusters.json', JSON.stringify([c], null, 2));
  const run = (args) => spawnSync('node', args, {stdio: 'inherit', env: {...process.env, MAX_PER_RUN: '1'}}).status;
  const ok = run(['scripts/agents/make-reels.mjs', `--id=${id}`]) === 0 && run(['scripts/notify-telegram.mjs']) === 0;
  const s2 = load();
  if (ok) { (s2.made ??= []).push(id); delete s2.menuClusters?.[id]; save(s2); }
  else await say(`✗ No pude hacer el reel de: ${c.headline}`);
}

// Temas (técnica / historia) y resúmenes elegidos en «Hoy toca»; y «hoy toca» pedido a mano.
const runNode = (args) => spawnSync('node', args, {stdio: 'inherit', env: process.env}).status === 0;
for (const tid of topicPicks) {
  await say(`🎞 Montando el vídeo del tema: ${tid}`);
  const ok = runNode(['scripts/agents/topic-reel.mjs', `--topic=${tid}`]) && runNode(['scripts/notify-telegram.mjs']);
  if (ok) { const s3 = load(); s3.topicsMade = [...new Set([...(s3.topicsMade ?? []), tid])]; save(s3); }
  else await say(`✗ No pude hacer el reel del tema ${tid}.`);
}
for (const mode of sumPicks) {
  await say(`🎞 Montando el resumen ${mode === 'week' ? 'de la semana' : 'de hoy'}…`);
  if (!(runNode(['scripts/agents/summary-reel.mjs', `--mode=${mode}`]) && runNode(['scripts/notify-telegram.mjs']))) await say(`✗ No pude hacer el resumen (${mode}).`);
}
if (hoy) runNode(['scripts/hoytoca.mjs', '--force']);
