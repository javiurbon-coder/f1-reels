// Publica un Reel con la Instagram Graph API.
// Requisitos: cuenta Business/Creator vinculada a una página de Facebook, app de Meta con permiso
// instagram_content_publish, y el vídeo en una URL pública (HTTPS) accesible por Meta.
//
// Uso:
//   IG_USER_ID=... IG_ACCESS_TOKEN=... node scripts/publish-instagram.mjs <video_url> "<caption>"
const API = 'https://graph.facebook.com/v23.0';
const {IG_USER_ID, IG_ACCESS_TOKEN} = process.env;
const [videoUrl, caption = ''] = process.argv.slice(2);
if (!IG_USER_ID || !IG_ACCESS_TOKEN || !videoUrl) {
  console.error('Faltan IG_USER_ID, IG_ACCESS_TOKEN o la URL del vídeo.');
  process.exit(1);
}

async function call(path, params, method = 'POST') {
  const url = new URL(`${API}/${path}`);
  const body = new URLSearchParams({access_token: IG_ACCESS_TOKEN, ...params});
  if (method === 'GET') body.forEach((v, k) => url.searchParams.set(k, v));
  const r = await fetch(url, method === 'POST' ? {method, body} : undefined);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(JSON.stringify(j.error ?? j));
  return j;
}

// 1) contenedor
const {id: containerId} = await call(`${IG_USER_ID}/media`, {
  media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true',
});

// 2) esperar a que Meta procese el vídeo (consulta cada 10 s, máx. 5 min)
for (let i = 0; i < 30; i++) {
  const {status_code} = await call(containerId, {fields: 'status_code'}, 'GET');
  if (status_code === 'FINISHED') break;
  if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Procesado fallido: ${status_code}`);
  await new Promise((r) => setTimeout(r, 10_000));
  if (i === 29) throw new Error('Tiempo de espera agotado');
}

// 3) publicar
const {id} = await call(`${IG_USER_ID}/media_publish`, {creation_id: containerId});
console.log('Publicado, id:', id);
