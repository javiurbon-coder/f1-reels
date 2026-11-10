import assert from 'node:assert/strict';
import {handleUpdate, parseLead} from './handle.mjs';
const st = {offset: 0, more: 0, items: {a1: {id: 'a1', msgId: 50, status: 'sent'}}};
let r = handleUpdate(st, {callback_query: {id: 'x', data: 'ok:a1', message: {message_id: 50, chat: {id: 7}}}}, 7);
assert.equal(st.items.a1.status, 'approved'); assert.equal(r.clear, 50);
r = handleUpdate(st, {callback_query: {id: 'x', data: 'more', message: {message_id: 50, chat: {id: 7}}}}, 7);
assert.equal(st.more, 1);
r = handleUpdate(st, {message: {text: 'titular: Alonso renueva hasta 2028', chat: {id: 7}, reply_to_message: {message_id: 50}}}, 7);
assert.equal(st.items.a1.status, 'edit'); assert.equal(st.items.a1.edit.headline, 'Alonso renueva hasta 2028');
r = handleUpdate(st, {message: {text: 'hola', chat: {id: 999}}}, 7); assert.equal(r.reply.length, 0); // ignora a desconocidos
r = handleUpdate(st, {callback_query: {id: 'x', data: 'drop:a1', message: {message_id: 1, chat: {id: 999}}}}, 7); assert.equal(st.items.a1.status, 'edit');
st.menuClusters = {c1: {id: 'c1', headline: 'Test'}};
r = handleUpdate(st, {callback_query: {id: 'x', data: 'pick:c1', message: {message_id: 9, chat: {id: 7}}}}, 7);
assert.deepEqual(st.picks, ['c1']);
r = handleUpdate(st, {callback_query: {id: 'x', data: 'pick:c1', message: {message_id: 9, chat: {id: 7}}}}, 7);
assert.deepEqual(st.picks, ['c1']); // no se duplica
r = handleUpdate(st, {callback_query: {id: 'x', data: 'pick:zzz', message: {message_id: 9, chat: {id: 7}}}}, 7);
assert.equal(st.picks.length, 1); // opción caducada
r = handleUpdate(st, {callback_query: {id: 'x', data: 'skip', message: {message_id: 9, chat: {id: 7}}}}, 7);
assert.equal(r.clear, 9);
const ppl = [{name: 'Nachez', handle: '@Nachez98', tier: 'creador', group: 'nachez'}, {name: 'Jorge Peiró', handle: '@JPEIR0', tier: 'periodista', group: 'relevo'}];
let l = parseLead('noticia: @Nachez98 Habrá GP de Qatar y Abu Dhabi, Ben Sulayem lo confirma', ppl);
assert.equal(l.source, 'Nachez'); assert.equal(l.tier, 'creador'); assert.match(l.title, /Qatar y Abu Dhabi/);
l = parseLead('https://x.com/JPEIR0/status/123456', ppl);
assert.equal(l.source, 'Jorge Peiró'); assert.equal(l.tier, 'periodista'); assert.equal(l.needsText, true);
l = parseLead('Me acaban de acreditar https://twitter.com/JPEIR0/status/99?s=20', ppl);
assert.equal(l.title, 'Me acaban de acreditar');
assert.equal(parseLead('hola qué tal', ppl), null);
st.menuClusters = {}; r = handleUpdate(st, {message: {text: 'noticia: Alonso renueva con Aston', chat: {id: 7}}}, 7);
assert.equal(st.leads.length, 1); assert.ok(st.more >= 1);
console.log('✓ bot: botones, correcciones y seguridad (solo tu chat)');

// --- temas, resúmenes y «hoy toca» ---
st.topicPicks = []; st.sumPicks = [];
r = handleUpdate(st, {callback_query: {id: 'x', data: 'topic:porpoising', message: {message_id: 9, chat: {id: 7}}}}, 7);
assert.deepEqual(st.topicPicks, ['porpoising']); assert.match(r.reply[0], /Porpoising/);
r = handleUpdate(st, {callback_query: {id: 'x', data: 'topic:porpoising', message: {message_id: 9, chat: {id: 7}}}}, 7);
assert.equal(st.topicPicks.length, 1);
r = handleUpdate(st, {callback_query: {id: 'x', data: 'topic:nope', message: {message_id: 9, chat: {id: 7}}}}, 7);
assert.equal(st.topicPicks.length, 1);
r = handleUpdate(st, {callback_query: {id: 'x', data: 'sum:day', message: {message_id: 9, chat: {id: 7}}}}, 7);
assert.deepEqual(st.sumPicks, ['day']);
r = handleUpdate(st, {message: {text: 'resumen semana', chat: {id: 7}}}, 7);
assert.deepEqual(st.sumPicks, ['day', 'week']);
r = handleUpdate(st, {message: {text: 'hoy toca', chat: {id: 7}}}, 7);
assert.equal(st.hoy, true);
console.log('temas/resumen OK');

// --- teclado fijo y comandos ---
{
  const mk = (t) => { const st = {offset: 0, more: 0, items: {}}; const r = handleUpdate(st, {message: {text: t, chat: {id: 7}}}, 7); return {st, r}; };
  assert.equal(mk('🎯 Hoy toca').st.hoy, true);
  assert.equal(mk('/hoy').st.hoy, true);
  assert.deepEqual(mk('📰 Resumen del día').st.sumPicks, ['day']);
  assert.deepEqual(mk('🗓 Resumen semana').st.sumPicks, ['week']);
  assert.deepEqual(mk('/semana').st.sumPicks, ['week']);
  assert.deepEqual(mk('/resumen').st.sumPicks, ['day']);
  assert.equal(mk('🔁 Otra noticia').st.more, 1);
  assert.equal(mk('/otra').st.more, 1);
  assert.equal(mk('/ayuda').r.keyboard, true);
  assert.equal(mk('/start').r.keyboard, true);
  console.log('teclado/comandos OK');
}

// --- repetir un tema a mano ---
{
  const go = (t) => { const st = {offset: 0, more: 0, items: {}}; const r = handleUpdate(st, {message: {text: t, chat: {id: 7}}}, 7); return {st, r}; };
  assert.deepEqual(go('tema efecto suelo').st.topicPicks, ['efecto-suelo']);
  assert.deepEqual(go('Repetir porpoising').st.topicPicks, ['porpoising']);
  assert.deepEqual(go('tema neumáticos').st.topicPicks, ['colores-neumaticos']);
  assert.equal(go('tema nada raro').st.topicPicks, undefined);
  assert.equal(go('temas').st.hoy, true);
  console.log('repetir tema OK');
}
