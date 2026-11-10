// Panel de revisión LOCAL (solo accesible desde tu PC). Nada se publica sin que pulses "Publicar".
// Uso: npm run review   → http://localhost:4173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {deleteItem, getItem, listItems, posterPath, rerender, saveItem, videoPath} from './lib/queue.mjs';
import {clean, queueBytes} from './lib/clean.mjs';
import {loadSeries} from './lib/series.mjs';
import {hasCredentials, publishReel} from './lib/instagram.mjs';
import {syncDrafts, restoreDrafts} from './lib/sync.mjs';
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
let studio = null; // Remotion Studio (el editor de fotogramas), uno a la vez
const stopStudio = () => { if (!studio) return; if (process.platform === 'win32') spawn('taskkill', ['/pid', String(studio.pid), '/T', '/F']); else studio.kill(); studio = null; };
process.on('exit', stopStudio);

const server = http.createServer(async (req, res) => {
  try {
    const host = (req.headers.host || '').split(':')[0];
    if (!['localhost', '127.0.0.1'].includes(host)) return json(res, 403, {error: 'solo local'});
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (req.method === 'GET' && p === '/') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
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
    if (req.method === 'POST' && p === '/api/restore') return json(res, 200, await restoreDrafts().catch((e) => ({added: [], error: String(e.message ?? e)})));
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
        if (action === 'studio') {
          const file = path.resolve('queue', id, 'studio-props.json');
          fs.writeFileSync(file, JSON.stringify(item.props, null, 2));
          stopStudio();
          let log = '';
          studio = spawn('npx', ['remotion', 'studio', 'src/index.ts', `--props="${file}"`, '--port=3010', '--no-open'], {shell: true, stdio: ['ignore', 'pipe', 'pipe']});
          studio.stdout.on('data', (d) => (log = (log + d).slice(-600)));
          studio.stderr.on('data', (d) => (log = (log + d).slice(-600)));
          let exited = false; studio.on('exit', () => (exited = true));
          for (let t = 0; t < 90 && !exited; t++) {            // espera hasta 90 s a que el editor responda
            await new Promise((r) => setTimeout(r, 1000));
            if (await fetch('http://localhost:3010').then((r) => r.ok).catch(() => false)) return json(res, 200, {url: `http://localhost:3010/${item.composition ?? 'Reel'}`});
          }
          return json(res, 500, {error: 'El editor no arrancó. ' + log.replace(/\x1b\[[0-9;]*m/g, '').trim().slice(-300)});
        }
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
<title>CONTRASTADO F1</title>
<style>
*{box-sizing:border-box}html,body{height:100%}
body{margin:0;background:#0f0f10;color:#eee;font:14px/1.4 system-ui,sans-serif;display:flex;flex-direction:column}
header{display:flex;gap:14px;align-items:center;padding:10px 16px;border-bottom:1px solid #26262a;flex-wrap:wrap}
h1{margin:0;font-size:14px;letter-spacing:1px;font-weight:800}h1 small{opacity:.45;font-weight:400;margin-left:6px}
.sp{flex:1}
button{font:inherit;border:1px solid #3a3a40;background:#1b1b1f;color:#eee;border-radius:8px;padding:6px 12px;cursor:pointer}
button:hover{background:#26262c}button:disabled{opacity:.4;cursor:not-allowed}
button.on{background:#ffd21f;color:#111;border-color:#ffd21f;font-weight:700}
button.ok{background:#2f9e5b;border-color:#2f9e5b;font-weight:700}button.go{background:#ffd21f;color:#111;border-color:#ffd21f;font-weight:700}button.bad{color:#ff8a7a}
a{color:inherit;text-decoration:none}
#plan{padding:8px 16px;border-bottom:1px solid #26262a;font-size:13px;color:#bbb;display:flex;gap:22px;flex-wrap:wrap}#plan:empty{display:none}
#plan b{color:#fff}#plan .w{color:#ffb454}
#app{flex:1;display:flex;min-height:0}
#list{width:310px;overflow:auto;border-right:1px solid #26262a}
.row{display:flex;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid #1c1c20;align-items:center}
.row:hover{background:#18181c}.row.on{background:#22222a;box-shadow:inset 3px 0 #ffd21f}
.row img{width:36px;height:64px;object-fit:cover;border-radius:5px;background:#000;flex:none}
.row b{display:block;font-size:13px;line-height:1.25;max-height:2.5em;overflow:hidden}.row small{color:#999}
#detail{flex:1;overflow:auto;padding:14px 16px;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;gap:14px 22px;align-items:start;min-width:0}
.vid{height:min(56vh,600px);aspect-ratio:9/16;background:#000;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.tl{grid-column:1/3;position:relative;user-select:none;padding-top:2px}
.ruler{position:relative;height:16px;font-size:10px;color:#777}.ruler span{position:absolute;transform:translateX(-50%)}
.trk{position:relative;height:42px;background:#16161a;border-radius:6px;margin-bottom:6px}
.blk{position:absolute;top:0;height:100%;padding:4px 6px;color:#111;font-size:11px;font-weight:600;overflow:hidden;white-space:nowrap;border-radius:6px;cursor:pointer;border:1px solid #0006}
.blk.sel{outline:2px solid #fff;z-index:2}.hd{position:absolute;left:-5px;top:0;width:10px;height:100%;cursor:col-resize;background:#fff6;z-index:3}
.voz{height:100%;background:#2b6e4f;border-radius:6px;padding:12px 8px;font-size:11px;white-space:nowrap}
#ph{position:absolute;top:0;bottom:0;width:2px;background:#ff3b3b;left:0;pointer-events:none;z-index:4}
.sc{border:1px solid #2c2c33;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.sc label,.gl label{display:flex;flex-direction:column;font-size:11px;color:#999;gap:2px}
input[type=text],input[type=number]{background:#16161a;color:#eee;border:1px solid #333;border-radius:6px;padding:5px 8px;font:13px system-ui;width:100%}
.two{display:flex;gap:8px}.hint{color:#777;font-size:12px}.dirty{color:#ffd21f;font-size:12px;display:none}
.vid video{height:100%;width:100%;object-fit:contain}
.info{flex:1;min-width:260px;max-width:620px;display:flex;flex-direction:column;gap:12px}
.info h2{margin:0;font-size:18px;line-height:1.25}
.tags{display:flex;gap:8px;color:#999;font-size:12px}
.acts{display:flex;gap:8px;flex-wrap:wrap}
.warn{font-size:12px;color:#ffb454}
textarea{width:100%;background:#16161a;color:#eee;border:1px solid #333;border-radius:8px;padding:8px;font:13px/1.4 ui-monospace,monospace;resize:vertical}
details{border-top:1px solid #26262a;padding-top:8px}summary{cursor:pointer;color:#aaa}
.src a{color:#7db3ff;word-break:break-all;font-size:12px}
.empty,.ph{color:#777;padding:40px;text-align:center}
@media(max-width:900px){#app{flex-direction:column}#list{width:100%;max-height:30vh;border-right:0}#detail{display:block}.vid{margin:auto}}
</style>
<header><h1>CONTRASTADO F1<small>panel v5</small></h1><span id="tabs"></span><span class="sp"></span><span id="disk" style="color:#777;font-size:12px"></span>
<button id="sync" title="Baja los borradores nuevos de GitHub">⬇ Traer</button><button id="restore" title="Vuelve a bajar los borradores que borraste (siguen 6 días en GitHub)">↩ Recuperar</button><button id="clean">Limpiar</button></header>
<div id="plan"></div>
<div id="app"><aside id="list"></aside><section id="detail" class="card"></section></div>
<script>
const H={'Content-Type':'application/json','x-review':'1'};
const S={fst:'open',sel:null,data:null,sig:''};
const LBL={pending:'Pendiente',approved:'Aprobado',published:'Publicado',rejected:'Rechazado',error:'Error',rendering:'Renderizando…'};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function call(m,u,b){const r=await fetch(u,{method:m,headers:H,body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)alert(j.error||'Error');return j}
async function load(force){
 const next=await (await fetch('/api/state')).json();
 const sig=JSON.stringify([next.items.map(i=>[i.id,i.status,i.updatedAt]),next.canPublish,next.canPhone]);
 if(!force&&sig===S.sig)return;
 S.sig=sig;S.data=next;draw()}
const hl=i=>(i.props&&i.props.headline)||i.id;
function plan(items){
 const recent=items.filter(i=>['pending','approved'].includes(i.status)&&Date.now()-new Date(i.createdAt)<40*3600e3);
 const pick=(f,by)=>recent.filter(f).sort(by)[0];
 const warn=i=>/Control de calidad|REVISA/.test(i.note||'')?' <span class="w">⚠ revisar</span>':'';
 const news=pick(i=>['noticias','mercado','resultado'].includes(i.series),(a,b)=>(b.sources||[]).length-(a.sources||[]).length);
 const tema=pick(i=>['tecnica','datos'].includes(i.series),(a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 const res=pick(i=>i.series==='resumen',(a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 const rows=[['13:30','Tema',tema],['18:30','Noticia',news],['21:00','Resumen',res]].filter(r=>r[2]);
 return rows.length?'<span>📅 Hoy:</span>'+rows.map(r=>'<span>'+r[0]+' '+r[1]+': <b>'+esc(hl(r[2]))+'</b>'+warn(r[2])+'</span>').join(''):''}
function rowHtml(i,sname){
 return '<div class="row'+(i.id===S.sel?' on':'')+'" data-sel="'+i.id+'"><img src="/media/'+i.id+'/poster.jpg" onerror="this.style.visibility=&quot;hidden&quot;"><div><b>'+esc(hl(i))+'</b><small>'+esc(sname[i.series]||i.series||'')+' · '+(LBL[i.status]||i.status)+'</small></div></div>'}
function fld(label,path,val){return '<label>'+label+'<input type="text" data-p="'+path+'" value="'+esc(val)+'"></label>'}
function sceneHtml(){
 const e=S.ed;if(!e)return'';const s=e.props.scenes&&e.props.scenes[e.sel];
 if(!s)return'<div class="hint">Haz clic en un bloque de la línea de tiempo para editar esa escena.</div>';
 const b='scenes.'+e.sel+'.';
 let h='<div class="sc"><b>Escena '+(e.sel+1)+' · '+esc(s.type)+'</b><div class="two"><label>Inicio (s)<input type="number" step="0.1" data-t="from" value="'+s.from.toFixed(1)+'"></label><label>Fin (s)<input type="number" step="0.1" data-t="to" value="'+s.to.toFixed(1)+'"></label></div>';
 if(s.title!==undefined)h+=fld('Título',b+'title',s.title);
 (s.rows||[]).forEach((r,k)=>{h+=fld('Fila '+(k+1),b+'rows.'+k+'.title',r.title)+fld('· subtítulo',b+'rows.'+k+'.sub',r.sub||'')});
 (s.parts||[]).forEach((r,k)=>{h+=fld('Paso '+(k+1),b+'parts.'+k+'.name',r.name)+fld('· subtítulo',b+'parts.'+k+'.sub',r.sub||'')});
 if(s.type==='hook')h+='<div class="hint">El gancho muestra el titular del vídeo (campo «Titular», más abajo).</div>';
 if(s.type==='sources')h+='<div class="hint">Muestra las fuentes del vídeo.</div>';
 return h+'</div>'}
function detail(i,d){
 const hasVideo=['pending','approved','published'].includes(i.status);
 const video=i.status==='rendering'?'<div class="ph">Renderizando…<br>(1-2 min)</div>':(hasVideo?'<video controls preload="metadata" poster="/media/'+i.id+'/poster.jpg" src="/media/'+i.id+'/video.mp4"></video>':'<div class="ph">Sin vídeo</div>');
 const can=i.status==='pending',appr=i.status==='approved';
 const warns=(i.note||'').split('\\n').filter(l=>/Control de calidad|REVISA|Guion de plantilla/.test(l)).slice(0,4).map(l=>'<div class="warn">⚠ '+esc(l.slice(0,170))+'</div>').join('');
 const srcs=(i.sources||[]).map(s=>'<div class="src">✓ <b>'+esc(s.name)+'</b> · <a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title||s.url)+'</a></div>').join('');
 const btn=[];
 if(can)btn.push('<button class="ok" data-a="approve">✓ Aprobar</button>');
 if(appr)btn.push('<button data-a="unapprove">Quitar aprobación</button>');
 if(can||appr){btn.push('<button class="go" data-a="save">💾 Guardar cambios</button>');
  btn.push('<a href="/media/'+i.id+'/video.mp4" download="'+i.id+'.mp4"><button type="button">⬇ MP4</button></a>');
  btn.push('<button data-a="phone"'+(d.canPhone?'':' title="Telegram sin configurar en este PC"')+'>📱 Al móvil'+(i.sentToPhone?' ✓':'')+'</button>')}
 if(appr)btn.push('<button class="go" data-a="publish"'+(d.canPublish?'':' disabled title="Faltan credenciales de Instagram"')+'>Publicar</button>');
 if(can||appr||i.status==='error')btn.push('<button class="bad" data-a="reject">Rechazar</button>');
 btn.push('<button class="bad" data-a="delete">🗑</button>');
 const editable=can||appr;
 return '<div class="vid">'+video+'</div><div class="info" data-id="'+i.id+'"><h2>'+esc(hl(i))+'</h2><div class="tags"><span>'+(LBL[i.status]||i.status)+'</span><span>'+(i.sources||[]).length+' fuente(s)</span><span class="dirty" id="dirty">● cambios sin guardar</span></div>'+warns+
  '<div class="acts">'+btn.join('')+'</div>'+
  (editable?'<div id="sceneEd">'+sceneHtml()+'</div><div class="gl sc"><b>Vídeo</b>'+fld('Titular','headline',(S.ed&&S.ed.props.headline)||'')+fld('Palabra destacada','hl',(S.ed&&S.ed.props.hl)||'')+'</div>':'')+
  '<label style="color:#999;font-size:12px">Texto para Instagram</label><textarea rows="5" data-f="caption">'+esc(i.caption)+'</textarea>'+
  (srcs?'<details><summary>Fuentes ('+i.sources.length+')</summary>'+srcs+'</details>':'')+
  '<details><summary>Guion y notas</summary><textarea rows="8" readonly>'+esc(i.note||'')+'</textarea></details>'+
  '<div class="hint">Cambiar textos o tiempos vuelve a renderizar el vídeo (1-2 min). La voz no cambia desde aquí.</div>'+
  '<div class="acts"><button data-a="studio">Abrir en Remotion Studio (avanzado)</button></div></div>'+
  (editable?'<div class="tl" id="tl"></div>':'')}
function drawTL(){
 const e=S.ed,el=$('tl');if(!e||!el)return;
 const sc=e.props.scenes||[],T=e.T;
 const col={hook:'#ffd21f',list:'#4aa3ff',dato:'#9b7bff',tecnico:'#35c58b',sources:'#8a8a95',mercado:'#ff7a5c',rumor:'#ff7a5c',resultado:'#ff7a5c'};
 let ticks='';for(let t=0;t<=T;t+=5)ticks+='<span style="left:'+(t/T*100)+'%">'+t+'s</span>';
 const blocks=sc.map((s,k)=>'<div class="blk'+(k===e.sel?' sel':'')+'" data-blk="'+k+'" style="left:'+(s.from/T*100)+'%;width:'+((s.to-s.from)/T*100)+'%;background:'+(col[s.type]||'#777')+'"><span>'+esc(s.type)+(s.title?': '+esc(s.title):'')+'</span>'+(k>0?'<i class="hd" data-hd="'+k+'"></i>':'')+'</div>').join('');
 const nar=e.props.narration,vw=nar?Math.min(100,nar.seconds/T*100):0;
 el.innerHTML='<div class="ruler">'+ticks+'</div><div class="trk">'+blocks+'</div><div class="trk"><div class="voz" style="width:'+vw+'%">🔊 Voz '+(nar?nar.seconds.toFixed(0)+' s':'(sin voz)')+'</div></div><div id="ph"></div>'}
function refreshScene(){const el=$('sceneEd');if(el)el.innerHTML=sceneHtml()}
function markDirty(){if(S.ed)S.ed.dirty=true;const b=$('dirty');if(b)b.style.display='inline'}
function setPath(o,path,v){const k=path.split('.');for(let n=0;n<k.length-1;n++)o=o[k[n]];o[k[k.length-1]]=v}
function draw(){
 const d=S.data,sname=Object.fromEntries(d.series.map(s=>[s.id,s.name]));
 $('disk').textContent=(d.bytes/1e6).toFixed(0)+' MB';
 $('tabs').innerHTML=[['open','Por revisar'],['approved','Aprobados'],['published','Publicados'],['all','Todo']].map(t=>'<button class="'+(S.fst===t[0]?'on':'')+'" data-k="fst" data-v="'+t[0]+'">'+t[1]+'</button>').join(' ');
 $('plan').innerHTML=plan(d.items);
 const items=d.items.filter(i=>S.fst==='all'||(S.fst==='open'?['pending','rendering','error'].includes(i.status):i.status===S.fst));
 if(!items.find(i=>i.id===S.sel))S.sel=items[0]?items[0].id:null;
 $('list').innerHTML=items.length?items.map(i=>rowHtml(i,sname)).join(''):'<div class="empty">Nada por aquí</div>';
 const it=items.find(i=>i.id===S.sel);
 if(it){if(!S.ed||S.ed.id!==it.id||(!S.ed.dirty&&S.ed.upd!==it.updatedAt)){const p=JSON.parse(JSON.stringify(it.props||{}));const sc=p.scenes||[];S.ed={id:it.id,upd:it.updatedAt,props:p,T:sc.length?sc[sc.length-1].to:60,sel:0,dirty:false}}}else S.ed=null;
 $('detail').innerHTML=it?detail(it,d):'<div class="empty">Elige un vídeo de la lista</div>';
 drawTL();if(S.ed&&S.ed.dirty){const b=$('dirty');if(b)b.style.display='inline'}}
document.addEventListener('click',async e=>{
 const row=e.target.closest('[data-sel]');if(row){if(S.ed&&S.ed.dirty&&row.dataset.sel!==S.ed.id&&!confirm('Tienes cambios sin guardar en este vídeo. ¿Descartarlos?'))return;if(S.ed&&row.dataset.sel!==S.ed.id)S.ed.dirty=false;S.sel=row.dataset.sel;return draw()}
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.k){S[b.dataset.k]=b.dataset.v;return draw()}
 const bigBtn=async(label,url,msg)=>{b.disabled=true;const t=b.textContent;b.textContent=label;const r=await call('POST',url);b.disabled=false;b.textContent=t;alert(r.error?('No se pudo: '+r.error):msg(r));load(true)};
 if(b.id==='sync')return bigBtn('Buscando…','/api/sync',r=>r.added.length?r.added.length+' borrador(es) nuevo(s)':'No hay borradores nuevos');
 if(b.id==='restore')return bigBtn('Recuperando…','/api/restore',r=>r.added.length?r.added.length+' recuperado(s)':'Nada que recuperar (o pasaron más de 6 días)');
 if(b.id==='clean'){const r=await call('POST','/api/clean');alert((r.freedBytes/1e6).toFixed(1)+' MB liberados');return load(true)}
 const card=b.closest('.info');if(!card)return;const id=card.dataset.id,a=b.dataset.a;
 const val=f=>card.querySelector('[data-f="'+f+'"]')&&card.querySelector('[data-f="'+f+'"]').value;
 if(a==='delete'){if(confirm('¿Borrar este vídeo? (se puede recuperar con «Recuperar» durante 6 días)')){await call('DELETE','/api/items/'+id);load(true)}return}
 if(a==='save'){const props=S.ed?S.ed.props:undefined;const was=S.ed&&S.ed.dirty;if(S.ed)S.ed.dirty=false;await call('POST','/api/items/'+id+'/save',{props:props,caption:val('caption')});if(was)alert('Guardado. Renderizando el vídeo nuevo (1-2 min)…');return load(true)}
 if(a==='studio'){b.disabled=true;b.textContent='Abriendo editor… (20-40 s)';const r=await call('POST','/api/items/'+id+'/studio');b.disabled=false;b.textContent='🎬 Editar vídeo';if(r.url)window.open(r.url,'_blank');return}
 if(a==='phone'){b.disabled=true;const r=await call('POST','/api/items/'+id+'/phone');b.disabled=false;if(r.sentToPhone)alert('Enviado al móvil ✓');return load(true)}
 if(a==='publish'){if(!confirm('Se publicará AHORA en Instagram con el texto mostrado. ¿Seguro?'))return;
  b.disabled=true;b.textContent='Publicando…';const r=await call('POST','/api/items/'+id+'/publish',{confirm:true});if(r.status==='published')alert('Publicado ✓');return load(true)}
 if(a==='approve'){await call('POST','/api/items/'+id+'/save',{caption:val('caption')})}
 await call('POST','/api/items/'+id+'/'+a);load(true)});

document.addEventListener('input',e=>{
 const t=e.target;if(!S.ed)return;
 if(t.dataset.p){setPath(S.ed.props,t.dataset.p,t.value);markDirty();drawTL();return}
 if(t.dataset.t){const sc=S.ed.props.scenes,k=S.ed.sel,v=Math.round(parseFloat(t.value)*10)/10;if(isNaN(v))return;
  if(t.dataset.t==='to'){const hi=k<sc.length-1?sc[k+1].to-1.5:v;if(v<sc[k].from+1.5||v>hi)return;sc[k].to=v;if(sc[k+1])sc[k+1].from=v}
  else{const lo=k>0?sc[k-1].from+1.5:0;if(k===0||v<lo||v>sc[k].to-1.5)return;sc[k].from=v;sc[k-1].to=v}
  markDirty();drawTL()}});
document.addEventListener('mousedown',ev=>{
 const tl=ev.target.closest('#tl');if(!tl||!S.ed)return;
 const e=S.ed,rect=tl.getBoundingClientRect();
 const tAt=x=>Math.max(0,Math.min(e.T,(x-rect.left)/rect.width*e.T));
 const hd=ev.target.closest('[data-hd]');
 if(hd){const k=+hd.dataset.hd;ev.preventDefault();
  const mv=m=>{const sc=e.props.scenes,lo=sc[k-1].from+1.5,hi=sc[k].to-1.5;const t=Math.round(Math.max(lo,Math.min(hi,tAt(m.clientX)))*10)/10;sc[k-1].to=t;sc[k].from=t;markDirty();drawTL();refreshScene()};
  const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};
  document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);return}
 const blk=ev.target.closest('[data-blk]');if(blk){e.sel=+blk.dataset.blk;refreshScene()}
 const v=document.querySelector('.vid video');if(v)v.currentTime=tAt(ev.clientX);drawTL()});
(function tick(){const v=document.querySelector('.vid video'),ph=document.getElementById('ph');if(v&&ph&&S.ed)ph.style.left=Math.min(100,v.currentTime/S.ed.T*100)+'%';requestAnimationFrame(tick)})();
load(true);
setInterval(()=>{const playing=[...document.querySelectorAll('video')].some(v=>!v.paused&&!v.ended);if(playing)return;const ae=document.activeElement;if(ae&&(ae.tagName==='TEXTAREA'||ae.tagName==='INPUT'))return;if(S.ed&&S.ed.dirty)return;load()},30000);
</script></html>
`;
