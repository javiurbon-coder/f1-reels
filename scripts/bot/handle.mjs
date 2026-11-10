import fs from 'node:fs';
const PEOPLE = () => { try { return JSON.parse(fs.readFileSync('config/people.json', 'utf8')); } catch { return []; } };
const URL_RE = /https?:\/\/\S+/i;
const TOPICS = () => { try { return JSON.parse(fs.readFileSync('config/evergreen.json', 'utf8')); } catch { return []; } };

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
  const out = {reply: [], answer: null, clear: null, keyboard: false};
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
    } else if (act === 'topic') {
      const t = TOPICS().find((x) => x.id === id);
      state.topicPicks ??= [];
      if (!t) { out.answer = 'Ese tema ya no existe'; }
      else if (state.topicPicks.includes(id)) { out.answer = 'Ya la tienes en marcha'; }
      else { state.topicPicks.push(id); out.answer = 'Elegido'; out.reply.push(`🎬 Preparando: ${t.headline}\n(unos minutos)`); }
    } else if (act === 'sum') {
      const mode = id === 'week' ? 'week' : 'day';
      state.sumPicks ??= [];
      if (state.sumPicks.includes(mode)) { out.answer = 'Ya está en marcha'; }
      else { state.sumPicks.push(mode); out.answer = 'Preparando el resumen'; out.reply.push(`📰 Preparando el resumen ${mode === 'week' ? 'de la semana' : 'de hoy'} (unos minutos).`); }
    } else if (act === 'skip') { out.answer = 'Vale'; out.clear = cb.message.message_id; out.reply.push('🙈 Vale, la dejo.'); }
    else if (act === 'more') { state.more++; out.answer = 'Preparando otro menú…'; out.reply.push('🔁 Preparando otro menú (unos minutos).'); }
    else if (it && act === 'ok') { it.status = 'approved'; out.answer = 'Aprobado'; out.clear = cb.message.message_id;
      out.reply.push('✅ Aprobado. Guarda el vídeo y pega el texto de arriba en Instagram.'); }
    else if (it && act === 'drop') { it.status = 'dropped'; out.answer = 'Descartado'; out.clear = cb.message.message_id; out.reply.push('🗑 Descartado.'); }
    return out;
  }
  const m = u.message;
  if (m?.text && String(m.chat?.id) === String(chat)) {
    // los botones del teclado fijo llevan emoji delante y los comandos «/», se quitan para reconocerlos igual que si los escribieras
    const raw = m.text;
    m.text = raw.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D/]+/u, '');
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
    } else if (/^\s*(resumen|semana)\b/i.test(m.text)) {
      const mode = /seman/i.test(m.text) ? 'week' : 'day';
      state.sumPicks ??= []; if (!state.sumPicks.includes(mode)) state.sumPicks.push(mode);
      out.reply.push(`📰 Preparando el resumen ${mode === 'week' ? 'de la semana' : 'de hoy'} (unos minutos).`);
    } else if (/^\s*(hoy( toca)?|temas?|qu[eé] subo)\b/i.test(m.text)) { state.hoy = true; out.reply.push('🎯 Te preparo las opciones de hoy (unos minutos).'); }
    else if (/^\s*(otra|más|mas)\b/i.test(m.text)) { state.more++; out.reply.push('🔁 Preparando otro menú.'); }
    else if (/^\s*(ayuda|start|men[uú]|botones)\b/i.test(m.text)) { out.keyboard = true; out.reply.push('Aquí tienes los botones abajo 👇. 🎯 Hoy toca: qué subir hoy. 📰 Resumen del día / 🗓 de la semana: un vídeo con varias noticias. 🔁 Otra noticia: más opciones.'); }
    else out.reply.push('Para corregir: responde a un vídeo con  «titular: …»  o  «guion: …».  Para sugerir una noticia: «noticia: @quien texto» o pega el enlace del tuit.  Para otro menú pulsa 🔁 o escribe «otra». «resumen» (o «resumen semana») junta las noticias; «hoy toca» te dice qué subir.');
  }
  return out;
}
