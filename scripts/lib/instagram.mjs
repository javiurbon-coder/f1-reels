// Publicación de un Reel con la API oficial de Instagram (gratis).
// Sube el archivo directamente (subida reanudable), sin necesidad de alojarlo en una URL pública.
// Necesita: IG_USER_ID, IG_ACCESS_TOKEN (cuenta Business/Creator + app de Meta con instagram_content_publish).
// Si la subida directa no funciona con tu configuración, define PUBLIC_VIDEO_BASE_URL y se usará video_url.
import fs from 'node:fs';

const HOST = process.env.IG_GRAPH_HOST || 'https://graph.facebook.com';
const VER = process.env.IG_GRAPH_VERSION || 'v23.0';

export const hasCredentials = () => !!(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);

async function api(path, params, method = 'POST') {
  const url = new URL(`${HOST}/${VER}/${path}`);
  const body = new URLSearchParams({access_token: process.env.IG_ACCESS_TOKEN, ...params});
  if (method === 'GET') body.forEach((v, k) => url.searchParams.set(k, v));
  const r = await fetch(url, method === 'POST' ? {method, body} : undefined);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(JSON.stringify(j.error ?? j));
  return j;
}

export async function publishReel({file, caption, publicUrl}) {
  if (!hasCredentials()) throw new Error('Faltan IG_USER_ID / IG_ACCESS_TOKEN');
  const uid = process.env.IG_USER_ID;
  let container;
  if (publicUrl) {
    container = await api(`${uid}/media`, {media_type: 'REELS', video_url: publicUrl, caption, share_to_feed: 'true'});
  } else {
    container = await api(`${uid}/media`, {media_type: 'REELS', upload_type: 'resumable', caption, share_to_feed: 'true'});
    const bytes = fs.readFileSync(file);
    const up = await fetch(container.uri, {
      method: 'POST',
      headers: {Authorization: `OAuth ${process.env.IG_ACCESS_TOKEN}`, offset: '0', file_size: String(bytes.length)},
      body: bytes,
    });
    const uj = await up.json().catch(() => ({}));
    if (!up.ok || uj.success === false) throw new Error('Subida fallida: ' + JSON.stringify(uj));
  }
  for (let i = 0; i < 36; i++) {
    const {status_code} = await api(container.id, {fields: 'status_code'}, 'GET');
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error('Instagram no pudo procesar el vídeo: ' + status_code);
    if (i === 35) throw new Error('Tiempo de espera agotado procesando el vídeo');
    await new Promise((r) => setTimeout(r, 10_000));
  }
  const {id} = await api(`${uid}/media_publish`, {creation_id: container.id});
  return id;
}
