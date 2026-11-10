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
