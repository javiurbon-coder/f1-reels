// Lógica pura: convierte una actualización de Telegram en cambios de estado (testeable sin red).
export function handleUpdate(state, u, chat) {
  const out = {reply: [], answer: null, clear: null};
  const cb = u.callback_query;
  if (cb && String(cb.message?.chat?.id) === String(chat)) {
    const [act, id] = cb.data.split(':');
    const it = state.items[id];
    if (act === 'more') { state.more++; out.answer = 'Buscando otra noticia…'; out.reply.push('🔁 Preparando otra noticia (tardará unos minutos).'); }
    else if (it && act === 'ok') { it.status = 'approved'; out.answer = 'Aprobado'; out.clear = cb.message.message_id;
      out.reply.push('✅ Aprobado. Guarda el vídeo y pega el texto de arriba en Instagram.'); }
    else if (it && act === 'drop') { it.status = 'dropped'; out.answer = 'Descartado'; out.clear = cb.message.message_id; out.reply.push('🗑 Descartado.'); }
    return out;
  }
  const m = u.message;
  if (m?.text && String(m.chat?.id) === String(chat)) {
    const target = m.reply_to_message && Object.values(state.items).find((i) => i.msgId === m.reply_to_message.message_id);
    const mt = m.text.match(/^\s*(titular|guion|guión)\s*:\s*([\s\S]+)/i);
    if (target && mt) {
      const kind = mt[1].toLowerCase().startsWith('tit') ? 'headline' : 'script';
      target.edit = {...(target.edit ?? {}), [kind]: mt[2].trim()};
      target.status = 'edit';
      out.reply.push(`✏️ Anotado. Rehago el vídeo con ${kind === 'headline' ? 'el nuevo titular' : 'el nuevo guion'} (unos minutos).`);
    } else if (/^\s*(otra|más|mas)\b/i.test(m.text)) { state.more++; out.reply.push('🔁 Preparando otra noticia.'); }
    else out.reply.push('Para corregir: responde a un vídeo con  «titular: …»  o  «guion: …».  Para otra noticia pulsa 🔁 o escribe «otra».');
  }
  return out;
}
