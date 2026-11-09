// Limpieza automática de la cola para que no ocupe espacio (reglas en config/settings.json → retention).
import fs from 'node:fs';
import path from 'node:path';
import {QUEUE, listItems, videoPath} from './queue.mjs';

const days = (iso) => (Date.now() - new Date(iso).getTime()) / 86400_000;

export function dirSize(d) {
  if (!fs.existsSync(d)) return 0;
  return fs.readdirSync(d, {withFileTypes: true}).reduce((n, e) => {
    const p = path.join(d, e.name);
    return n + (e.isDirectory() ? dirSize(p) : fs.statSync(p).size);
  }, 0);
}
export const queueBytes = () => dirSize(QUEUE);

export function clean() {
  const r = JSON.parse(fs.readFileSync('config/settings.json', 'utf8')).retention;
  const out = {removed: 0, videosDeleted: 0, freedBytes: 0};
  const before = queueBytes();
  for (const it of listItems()) {
    const age = days(it.updatedAt ?? it.createdAt);
    const dir = path.join(QUEUE, it.id);
    if ((it.status === 'rejected' && age > r.rejectedDays) ||
        (it.status === 'pending' && age > r.pendingMaxDays) ||
        (it.status === 'error' && age > r.errorDays)) {
      fs.rmSync(dir, {recursive: true, force: true});
      out.removed++;
    } else if (it.status === 'published' && age > r.publishedKeepVideoDays && fs.existsSync(videoPath(it.id))) {
      fs.rmSync(videoPath(it.id)); // se conserva item.json y la miniatura como registro
      out.videosDeleted++;
    }
  }
  out.freedBytes = Math.max(0, before - queueBytes());
  return out;
}

if (process.argv[1].endsWith('clean.mjs')) {
  const o = clean();
  console.log(`OK → ${o.removed} elementos borrados, ${o.videosDeleted} vídeos publicados eliminados, ${(o.freedBytes / 1e6).toFixed(1)} MB liberados`);
}
