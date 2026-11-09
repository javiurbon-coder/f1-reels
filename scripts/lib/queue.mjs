// Cola de revisión en disco: queue/<id>/item.json + video.mp4
import fs from 'node:fs';
import path from 'node:path';
import {renderFrame, renderVideo} from './render.mjs';
import {seriesOf} from './series.mjs';

export const QUEUE = path.resolve('queue');
export const safeId = (id) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('id no válido');
  return id;
};
const dir = (id) => path.join(QUEUE, safeId(id));
const file = (id) => path.join(dir(id), 'item.json');

export const getItem = (id) => (fs.existsSync(file(id)) ? JSON.parse(fs.readFileSync(file(id), 'utf8')) : null);
export const saveItem = (item) => {
  item = {...item, updatedAt: new Date().toISOString()};
  fs.mkdirSync(dir(item.id), {recursive: true});
  fs.writeFileSync(file(item.id), JSON.stringify(item, null, 2));
  return item;
};
export const posterPath = (id) => path.join(dir(id), 'poster.jpg');
export const deleteItem = (id) => {
  fs.rmSync(dir(id), {recursive: true, force: true});
  fs.rmSync(path.resolve('public/audio', safeId(id) + '.wav'), {force: true}); // la voz en off también
};

async function renderAll(item) {
  await renderVideo({id: item.composition, props: item.props, out: videoPath(item.id)});
  const frame = JSON.parse(fs.readFileSync('config/settings.json', 'utf8')).posterFrame ?? 45;
  await renderFrame({id: item.composition, props: item.props, frame, out: posterPath(item.id)});
}
export const videoPath = (id) => path.join(dir(id), 'video.mp4');
export const listItems = () =>
  fs.existsSync(QUEUE)
    ? fs.readdirSync(QUEUE).map((d) => getItem(d)).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

/** Crea el elemento, renderiza el vídeo y lo deja "pendiente de revisión". */
export async function enqueue({id, composition, props, caption, sources = [], note = '', series}) {
  if (getItem(id)) return {skipped: true, item: getItem(id)};
  const item = saveItem({id, composition, props, caption, sources, note, series: series ?? seriesOf(composition), status: 'rendering', createdAt: new Date().toISOString()});
  try {
    await renderAll(item);
    return {item: saveItem({...item, status: 'pending'})};
  } catch (e) {
    saveItem({...item, status: 'error', error: String(e.message ?? e)});
    throw e;
  }
}

export async function rerender(id, {props, caption}) {
  const item = getItem(id);
  if (!item) throw new Error('no existe');
  if (item.status === 'published') throw new Error('ya publicado');
  const next = saveItem({...item, props: props ?? item.props, caption: caption ?? item.caption, status: 'rendering'});
  try {
    if (props) await renderAll(next);
    return saveItem({...next, status: 'pending'});
  } catch (e) {
    saveItem({...next, status: 'error', error: String(e.message ?? e)});
    throw e;
  }
}
