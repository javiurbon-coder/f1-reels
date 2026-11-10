import fs from 'node:fs';
const PEOPLE = () => { try { return JSON.parse(fs.readFileSync('config/people.json', 'utf8')); } catch { return []; } };
const URL_RE = /https?:\/\/\S+/i;

/** «noticia: …» / «pista: …» / un enlace de X o un tuit reenviado → pista (rumor hasta que otros medios la confirmen). */
export function parseLead(text, people = PEOPLE()) {
  const m = text.match(/^\s*(noticia|pista|rumor|tuit|tweet)\s*:?\s*([\s\S]+)/i);
  const url = text.match(URL_RE)?.[0];
  const isX = url && /^https?:\/\/(www\.)?(x|twitter)\.com\//i.test(url);
  if (!m && !isX) return null;
  let body = (m ? m[2] : text).trim();
  let handle = url?.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status/i)?.[1];
  const at = body.match(/^@([A-Za-z0-9_]+)\s*[:|\-–]?\s*/);
  if (at) { handle ??= at[1]; body = body.slice(at[0].length); }
  if (url) body = body.replace(url, '').trim();
  const p = handle && people.find((x) => (x.handle ?? '').replace('@', '').toLowerCase() === handle.toLowerCase());
  const name = p?.name ?? (handle ? '@' + handle : 'Pista manual');
  return {source: name, group: p?.group ?? name, tier: p?.tier ?? 'creador', official: false, lang: 'es', manual: true,
    domain: url ? new URL(url).hostname.replace(/^www\./, '') : 'telegram', link: url ?? `https://t.me/pista/${Date.now()}`,
    title: body, needsText: !body && !!isX, published: new Date().toISOString()};
}

// Lógica pura: convierte una actualización de Telegram en cambios de estado (testeable sin red).
export function handleUpdate(state, u, chat) {
  const out = {reply: [], answer: null, clear: null};
  const cb = u.callback_query;
  if (cb && String(cb.message?.chat?.id) === String(chat)) {
    const [act, id] = cb.data.split(':');
    const it = state.items[id];
    if (act === 'pick') {
      state.picks ??= [];
      const known = state.menuClusters?.[id];
      if (!known) { out.answer = 'Esa opción ya caducó'; out.reply.push('⏳ Esa noticia ya no está disponible. Pide otro menú con 🔁.'); }
      else if (state.picks.includes(id) || state.made?.includes(id)) { out.answer = 'Ya la tienes en marcha'; }
      else { state.picks.push(id); out.answer = 'Elegida'; out.reply.push(`🎬 Preparando: ${known.headline}\n(unos minutos)`); }
    } else if (act === 'skip') { out.answer = 'Vale'; out.clear = cb.message.message_id; out.reply.push('😴 Hoy nada. Mañana habrá menú nuevo.'); }
    else if (act === 'more') { state.more++; out.answer = 'Preparando otro menú…'; out.reply.push('🔁 Preparando otro menú (unos minutos).'); }
    else if (it && act === 'ok') { it.status = 'approved'; out.answer = 'Aprobado'; out.clear = cb.message.message_id;
      out.reply.push('✅ Aprobado. Guarda el vídeo y pega el texto de arriba en Instagram.'); }
    else if (it && act === 'drop') { it.status = 'dropped'; out.answer = 'Descartado'; out.clear = cb.message.message_id; out.reply.push('🗑 Descartado.'); }
    return out;
  }
  const m = u.message;
  if (m?.text && String(m.chat?.id) === String(chat)) {
    const lead = !m.reply_to_message ? parseLead(m.text) : null;
    if (lead) {
      (state.leads ??= []).push(lead); state.more++;
      out.reply.push(`📌 Anotada (${lead.source}, ${lead.tier}).${lead.needsText ? ' Intento leer el tuit.' : ''} Si solo la cuenta esa persona saldrá como RUMOR sin confirmar; si otros medios la recogen, sube de nivel. Te mando un menú con ella en unos minutos.`);
      return out;
    }
    const target = m.reply_to_message && Object.values(state.items).find((i) => i.msgId === m.reply_to_message.message_id);
    const mt = m.text.match(/^\s*(titular|guion|guión)\s*:\s*([\s\S]+)/i);
    if (target && mt) {
      const kind = mt[1].toLowerCase().startsWith('tit') ? 'headline' : 'script';
      target.edit = {...(target.edit ?? {}), [kind]: mt[2].trim()};
      target.status = 'edit';
      out.reply.push(`✏️ Anotado. Rehago el vídeo con ${kind === 'headline' ? 'el nuevo titular' : 'el nuevo guion'} (unos minutos).`);
    } else if (/^\s*(otra|más|mas)\b/i.test(m.text)) { state.more++; out.reply.push('🔁 Preparando otro menú.'); }
    else out.reply.push('Para corregir: responde a un vídeo con  «titular: …»  o  «guion: …».  Para sugerir una noticia: «noticia: @quien texto» o pega el enlace del tuit.  Para otro menú pulsa 🔁 o escribe «otra».');
  }
  return out;
}
