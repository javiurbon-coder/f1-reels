// Baja a tu PC los borradores que el robot dejó en la release «borradores» de GitHub (repo público: no hace falta clave).
import fs from 'node:fs';
import path from 'node:path';
import {QUEUE, getItem, saveItem, safeId} from './queue.mjs';

const REPO = process.env.GITHUB_REPO || 'javiurbon-coder/f1-reels';
const KNOWN = 'data/state/synced.json'; // ids ya traídos: lo que borres en el panel no vuelve a bajar
const known = () => (fs.existsSync(KNOWN) ? JSON.parse(fs.readFileSync(KNOWN, 'utf8')) : []);

async function download(url, to) {
  const r = await fetch(url, {redirect: 'follow'});
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  fs.mkdirSync(path.dirname(to), {recursive: true});
  fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
}

/** @returns {Promise<{added:string[], error?:string}>} */
export async function syncDrafts() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/borradores`, {headers: {accept: 'application/vnd.github+json'}}).catch(() => null);
  if (!r) return {added: [], error: 'sin conexión con GitHub'};
  if (r.status === 404) return {added: []}; // aún no hay ningún borrador
  if (!r.ok) return {added: [], error: `GitHub respondió ${r.status}`};
  const assets = (await r.json()).assets ?? [];
  const byId = {};
  for (const a of assets) { const m = a.name.match(/^(.+)\.(json|mp4|jpg|mp3|wav)$/); if (m) (byId[m[1]] ??= {})[m[2]] = a; }
  const seen = known(), added = [];
  for (const [id, f] of Object.entries(byId)) {
    if (!f.json || !f.mp4 || seen.includes(id) || getItem(safeId(id))) continue; // solo borradores completos y nuevos
    const dir = path.join(QUEUE, id);
    await download(f.mp4.browser_download_url, path.join(dir, 'video.mp4'));
    if (f.jpg) await download(f.jpg.browser_download_url, path.join(dir, 'poster.jpg'));
    for (const ext of ['mp3', 'wav']) if (f[ext]) await download(f[ext].browser_download_url, path.resolve('public/audio', `${id}.${ext}`));
    const item = await (await fetch(f.json.browser_download_url)).json();
    saveItem({...item, status: 'pending', fromCloud: true});
    seen.push(id); added.push(id);
  }
  fs.mkdirSync(path.dirname(KNOWN), {recursive: true});
  fs.writeFileSync(KNOWN, JSON.stringify(seen.slice(-500)));
  return {added};
}

/** Recupera los borradores que borraste en el panel: olvida la lista de «ya traídos» y vuelve a bajar lo que siga en GitHub (unos 6 días). */
export async function restoreDrafts() {
  fs.mkdirSync(path.dirname(KNOWN), {recursive: true});
  fs.writeFileSync(KNOWN, '[]');
  return syncDrafts();
}
