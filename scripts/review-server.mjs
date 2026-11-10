// Panel de revisión LOCAL (solo accesible desde tu PC). Nada se publica sin que pulses "Publicar".
// Uso: npm run review   → http://localhost:4173
import http from 'node:http';
import fs from 'node:fs';
import {deleteItem, getItem, listItems, posterPath, rerender, saveItem, videoPath} from './lib/queue.mjs';
import {clean, queueBytes} from './lib/clean.mjs';
import {loadSeries} from './lib/series.mjs';
import {hasCredentials, publishReel} from './lib/instagram.mjs';
import {syncDrafts} from './lib/sync.mjs';
import {configured as tgOn, sendVideo, say} from './bot/tg.mjs';

const PORT = Number(process.env.PORT || 4173);
const json = (res, code, body) => {
  res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((ok) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => ok(b ? JSON.parse(b) : {}));
  });

function sendFile(req, res, file, type) {
  if (!fs.existsSync(file)) return json(res, 404, {error: 'no existe'});
  const {size} = fs.statSync(file);
  const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, {'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1});
    fs.createReadStream(file, {start, end}).pipe(res);
  } else {
    res.writeHead(200, {'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes'});
    fs.createReadStream(file).pipe(res);
  }
}

const busy = new Set();

const server = http.createServer(async (req, res) => {
  try {
    const host = (req.headers.host || '').split(':')[0];
    if (!['localhost', '127.0.0.1'].includes(host)) return json(res, 403, {error: 'solo local'});
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (req.method === 'GET' && p === '/') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      return res.end(PAGE);
    }
    if (req.method === 'GET' && p === '/api/state') {
      return json(res, 200, {items: listItems(), series: loadSeries(), bytes: queueBytes(), canPublish: hasCredentials(), canPhone: tgOn()});
    }
    let m;
    if (req.method === 'GET' && (m = p.match(/^\/media\/([\w-]+)\/video\.mp4$/))) return sendFile(req, res, videoPath(m[1]), 'video/mp4');
    if (req.method === 'GET' && (m = p.match(/^\/media\/([\w-]+)\/poster\.jpg$/))) return sendFile(req, res, posterPath(m[1]), 'image/jpeg');

    // Todas las acciones que cambian cosas exigen esta cabecera (evita que otra web las dispare).
    if (req.method !== 'GET' && req.headers['x-review'] !== '1') return json(res, 403, {error: 'cabecera requerida'});

    if (req.method === 'POST' && p === '/api/clean') return json(res, 200, clean());
    if (req.method === 'POST' && p === '/api/sync') return json(res, 200, await syncDrafts().catch((e) => ({added: [], error: String(e.message ?? e)})));

    if ((m = p.match(/^\/api\/items\/([\w-]+)(?:\/(\w+))?$/))) {
      const [, id, action] = m;
      const item = getItem(id);
      if (!item) return json(res, 404, {error: 'no existe'});

      if (req.method === 'DELETE') {
        if (busy.has(id)) return json(res, 409, {error: 'ocupado'});
        deleteItem(id);
        return json(res, 200, {ok: true});
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (action === 'save') {
          if (busy.has(id)) return json(res, 409, {error: 'ya se está renderizando'});
          const propsChanged = body.props && JSON.stringify(body.props) !== JSON.stringify(item.props);
          if (propsChanged) {
            busy.add(id);
            saveItem({...item, status: 'rendering', caption: body.caption ?? item.caption});
            rerender(id, {props: body.props, caption: body.caption}).catch(() => {}).finally(() => busy.delete(id));
            return json(res, 202, {rendering: true});
          }
          return json(res, 200, saveItem({...item, caption: body.caption ?? item.caption, status: item.status === 'approved' ? 'pending' : item.status}));
        }
        if (action === 'approve' && item.status === 'pending') return json(res, 200, saveItem({...item, status: 'approved'}));
        if (action === 'unapprove' && item.status === 'approved') return json(res, 200, saveItem({...item, status: 'pending'}));
        if (action === 'reject' && ['pending', 'approved', 'error'].includes(item.status)) return json(res, 200, saveItem({...item, status: 'rejected'}));
        if (action === 'phone') {
          if (!tgOn()) return json(res, 400, {error: 'Telegram no está configurado en este PC. Ejecuta una vez: node scripts/notify-telegram.mjs setup <TOKEN_DEL_BOT>'});
          if (!['pending', 'approved'].includes(item.status)) return json(res, 409, {error: 'solo se envían vídeos pendientes o aprobados'});
          const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          await sendVideo(videoPath(id), `${(item.series ?? '').toUpperCase()} · ${item.props?.headline ?? id}`, id);
          await say(`📋 Toca el texto para copiarlo:\n\n<code>${esc(item.caption)}</code>`, {parse_mode: 'HTML'});
          return json(res, 200, saveItem({...item, sentToPhone: new Date().toISOString()}));
        }
        if (action === 'publish') {
          if (item.status !== 'approved') return json(res, 409, {error: 'primero hay que aprobarlo'});
          if (body.confirm !== true) return json(res, 400, {error: 'falta confirmación'});
          if (!hasCredentials()) return json(res, 400, {error: 'Faltan IG_USER_ID / IG_ACCESS_TOKEN en el entorno'});
          if (busy.has(id)) return json(res, 409, {error: 'ocupado'});
          busy.add(id);
          try {
            const igId = await publishReel({file: videoPath(id), caption: item.caption});
            return json(res, 200, saveItem({...item, status: 'published', publishedId: igId, publishedAt: new Date().toISOString()}));
          } catch (e) {
            return json(res, 502, {error: String(e.message ?? e)});
          } finally {
            busy.delete(id);
          }
        }
        return json(res, 400, {error: 'acción no válida en este estado'});
      }
    }
    json(res, 404, {error: 'no encontrado'});
  } catch (e) {
    json(res, 500, {error: String(e.message ?? e)});
  }
});

const autoSync = () => syncDrafts().then((r) => console.log(r.error ? `Borradores: ${r.error}` : `Borradores nuevos: ${r.added.length}`)).catch(() => {});
autoSync(); setInterval(autoSync, 5 * 60e3); // trae lo del robot al arrancar y cada 5 minutos: no hay que pulsar nada
const c = clean(); // limpieza al arrancar
console.log(`Limpieza: ${c.removed} borrados, ${c.videosDeleted} vídeos antiguos eliminados.`);
server.listen(PORT, '127.0.0.1', () => console.log(`Panel de revisión: http://localhost:${PORT}  (Ctrl+C para cerrar)`));

const PAGE = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisión · CONTRASTADO F1</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6e8c8;font:16px/1.4 system-ui,sans-serif;color:#111}
header{position:sticky;top:0;z-index:5;background:#111;color:#fff;padding:14px 22px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
header h1{margin:0;font-size:20px;letter-spacing:1px}.sp{flex:1}
.chip{border:3px solid #111;background:#fff;border-radius:999px;padding:5px 14px;font-weight:700;cursor:pointer;font-size:14px}
.chip.on{background:#ffd21f}header .chip{border-color:#fff;color:#111}
main{padding:22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:22px}
.card{background:#fff;border:4px solid #111;border-radius:18px;box-shadow:8px 8px 0 #111;overflow:hidden;display:flex;flex-direction:column}
.media{background:#000;aspect-ratio:9/16;max-height:520px;width:100%;display:flex;align-items:center;justify-content:center}
.media video,.media img{height:100%;max-width:100%;object-fit:contain}
.body{padding:14px;display:flex;flex-direction:column;gap:10px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.badge{font-size:12px;font-weight:800;text-transform:uppercase;border:3px solid #111;border-radius:8px;padding:2px 8px}
.s-pending{background:#ffd21f}.s-approved{background:#7be07b}.s-published{background:#2b6cff;color:#fff}.s-rejected,.s-error{background:#ff3b1d;color:#fff}.s-rendering{background:#ddd}
textarea{width:100%;font:14px/1.35 ui-monospace,monospace;border:3px solid #111;border-radius:10px;padding:8px;resize:vertical}
details summary{cursor:pointer;font-weight:700}
button{font:inherit;font-weight:800;border:3px solid #111;border-radius:10px;padding:7px 14px;cursor:pointer;background:#fff;box-shadow:3px 3px 0 #111}
button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #111}button:disabled{opacity:.45;cursor:not-allowed}
.ok{background:#7be07b}.go{background:#ffd21f}.bad{background:#ff8a7a}
.src a{color:#1d4ed8;word-break:break-all;font-size:13px}.note{background:#fff3b0;border:2px dashed #111;border-radius:8px;padding:6px 10px;font-size:13px}
#plan{margin:18px 22px 0;background:#fff;border:4px solid #111;border-radius:18px;box-shadow:6px 6px 0 #111;padding:12px 16px}#plan:empty{display:none}#plan h2{margin:0 0 8px;font-size:17px}#plan .r{display:flex;gap:10px;align-items:baseline;padding:4px 0;border-top:2px dashed #ddd}#plan .t{font-weight:800;min-width:92px}#plan .w{color:#b42318;font-size:13px;font-weight:700}
.empty{grid-column:1/-1;text-align:center;padding:60px;font-weight:700}
</style>
<header><h1>CONTRASTADO F1 · REVISIÓN</h1><div id="series"></div><div id="status"></div><span class="sp"></span><span id="disk"></span>
<button id="sync" title="Baja los borradores que el robot ha montado en GitHub">⬇ Traer borradores</button> <button id="clean" title="Aplica las reglas de retención">Limpiar espacio</button></header>
<section id="plan"></section>
<main id="list"></main>
<script>
const H={'Content-Type':'application/json','x-review':'1'};
const S={fs:'all',fst:'open',data:null};
const LBL={pending:'Pendiente',approved:'Aprobado',published:'Publicado',rejected:'Rechazado',error:'Error',rendering:'Renderizando…'};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function call(m,u,b){const r=await fetch(u,{method:m,headers:H,body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)alert(j.error||'Error');return j}
async function load(force){
 const next=await (await fetch('/api/state')).json();
 const sig=JSON.stringify([next.items.map(i=>[i.id,i.status,i.updatedAt]),next.canPublish,next.canPhone]);
 if(!force&&sig===S.sig)return; // nada ha cambiado: no se toca la pantalla (así los vídeos no se reinician)
 S.sig=sig;S.data=next;draw()}
function plan(items){
 const recent=items.filter(i=>['pending','approved'].includes(i.status)&&Date.now()-new Date(i.createdAt)<40*3600e3);
 const warn=i=>/Control de calidad|REVISA/.test(i.note||'')?'⚠ revisa antes de publicar':'';
 const hl=i=>(i.props&&i.props.headline)||i.id;
 const pick=(f,by)=>recent.filter(f).sort(by)[0];
 const news=pick(i=>['noticias','mercado','resultado'].includes(i.series),(a,b)=>(b.sources||[]).length-(a.sources||[]).length);
 const tema=pick(i=>['tecnica','datos'].includes(i.series),(a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 const res=pick(i=>i.series==='resumen',(a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 const rows=[['13:30','Tema (técnica o historia)',tema],['18:30','Noticia del día',news],['21:00','Resumen del día',res]];
 const ok=rows.filter(r=>r[2]);
 if(!ok.length)return'';
 return '<h2>📅 Para hoy te recomiendo publicar</h2>'+rows.map(r=>'<div class="r"><span class="t">'+r[0]+'</span><span>'+r[1]+': '+(r[2]?'<b>'+esc(hl(r[2]))+'</b> <span class="w">'+warn(r[2])+'</span>':'<i>aún no hay borrador</i>')+'</span></div>').join('');
}
function draw(){
 const d=S.data;
 document.getElementById('plan').innerHTML=plan(d.items);
 document.getElementById('disk').textContent='Ocupa '+(d.bytes/1e6).toFixed(1)+' MB';
 const mk=(arr,key,cur)=>arr.map(([v,l])=>'<button class="chip '+(cur===v?'on':'')+'" data-k="'+key+'" data-v="'+v+'">'+esc(l)+'</button>').join(' ');
 document.getElementById('series').innerHTML=mk([['all','Todas'],...d.series.map(s=>[s.id,s.name])],'fs',S.fs);
 document.getElementById('status').innerHTML=mk([['open','Por revisar'],['approved','Aprobados'],['published','Publicados'],['all','Todo']],'fst',S.fst);
 const sname=Object.fromEntries(d.series.map(s=>[s.id,s]));
 const items=d.items.filter(i=>(S.fs==='all'||i.series===S.fs)&&(S.fst==='all'||(S.fst==='open'?['pending','rendering','error'].includes(i.status):i.status===S.fst)));
 document.getElementById('list').innerHTML=items.length?items.map(i=>{
  const ser=sname[i.series];const hasVideo=['pending','approved','published'].includes(i.status);
  const media=i.status==='rendering'?'<div style="color:#fff">Renderizando…</div>':
    (hasVideo?'<video controls preload="metadata" poster="/media/'+i.id+'/poster.jpg" src="/media/'+i.id+'/video.mp4" onerror="this.outerHTML=\\'<img src=/media/'+i.id+'/poster.jpg>\\'"></video>':'<img src="/media/'+i.id+'/poster.jpg" onerror="this.remove()">');
  const srcs=(i.sources||[]).map(s=>'<div class="src">✓ <b>'+esc(s.name)+'</b> · <a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title||s.url)+'</a></div>').join('');
  const can=i.status==='pending',appr=i.status==='approved';
  return '<div class="card" data-id="'+i.id+'"><div class="media">'+media+'</div><div class="body">'+
   '<div class="row"><span class="badge" style="background:'+(ser?.color||'#ddd')+';color:'+(['#111111','#2b6cff','#ff3b1d'].includes(ser?.color)?'#fff':'#111')+'">'+esc(ser?.name||i.series)+'</span><span class="badge s-'+i.status+'">'+LBL[i.status]+'</span></div>'+
   (i.note?'<div class="note">'+esc(i.note)+'</div>':'')+
   (i.error?'<div class="note">'+esc(i.error)+'</div>':'')+
   (srcs?'<details open><summary>Fuentes ('+i.sources.length+')</summary>'+srcs+'</details>':'')+
   '<details><summary>Datos del vídeo (editar y re-renderizar)</summary><textarea rows="8" data-f="props">'+esc(JSON.stringify(i.props,null,2))+'</textarea></details>'+
   '<label><b>Pie de foto</b></label><textarea rows="6" data-f="caption">'+esc(i.caption)+'</textarea>'+
   '<div class="row">'+
    (can||appr?'<button data-a="save">Guardar</button><button data-a="phone" '+(d.canPhone?'':'title="Telegram sin configurar en este PC"')+'>📱 Al móvil'+(i.sentToPhone?' ✓':'')+'</button>':'')+
    (can?'<button class="ok" data-a="approve">✓ Aprobar</button>':'')+
    (appr?'<button data-a="unapprove">Quitar aprobación</button><button class="go" data-a="publish" '+(d.canPublish?'':'disabled title="Faltan credenciales de Instagram"')+'>Publicar en Instagram</button>':'')+
    (can||appr||i.status==='error'?'<button class="bad" data-a="reject">Rechazar</button>':'')+
    '<button data-a="delete">🗑 Borrar</button>'+
   '</div></div></div>'}).join(''):'<div class="empty">Nada por aquí.</div>';
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.k){S[b.dataset.k]=b.dataset.v;return draw()}
 if(b.id==='sync'){b.disabled=true;b.textContent='Buscando…';const r=await call('POST','/api/sync');b.disabled=false;b.textContent='⬇ Traer borradores';alert(r.error?('No se pudo: '+r.error):(r.added.length?r.added.length+' borrador(es) nuevo(s)':'No hay borradores nuevos'));return load(true)}
 if(b.id==='clean'){const r=await call('POST','/api/clean');alert((r.freedBytes/1e6).toFixed(1)+' MB liberados');return load(true)}
 const card=b.closest('.card');if(!card)return;const id=card.dataset.id,a=b.dataset.a;
 const val=f=>card.querySelector('[data-f="'+f+'"]')?.value;
 if(a==='delete'){if(confirm('¿Borrar este elemento y su vídeo? No se puede deshacer.')){await call('DELETE','/api/items/'+id);load(true)}return}
 if(a==='save'){let props;try{props=JSON.parse(val('props'))}catch{return alert('El JSON de datos no es válido')}
  await call('POST','/api/items/'+id+'/save',{props,caption:val('caption')});return load(true)}
 if(a==='publish'){if(!confirm('Se publicará AHORA en Instagram con el pie de foto mostrado. ¿Seguro?'))return;
  b.disabled=true;b.textContent='Publicando…';const r=await call('POST','/api/items/'+id+'/publish',{confirm:true});if(r.status==='published')alert('Publicado ✓');return load(true)}
 if(a==='phone'){b.disabled=true;const r=await call('POST','/api/items/'+id+'/phone');b.disabled=false;if(r.sentToPhone)alert('Enviado al móvil ✓');return load(true)}
 if(a==='approve'){await call('POST','/api/items/'+id+'/save',{caption:val('caption')})}
 await call('POST','/api/items/'+id+'/'+a);load(true)
});
load();setInterval(()=>{const playing=[...document.querySelectorAll('video')].some(v=>!v.paused&&!v.ended);if(playing)return;if(!document.activeElement||document.activeElement.tagName!=='TEXTAREA')load()},4000);
</script></html>`;
