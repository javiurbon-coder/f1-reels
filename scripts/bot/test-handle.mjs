import assert from 'node:assert/strict';
import {handleUpdate} from './handle.mjs';
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
console.log('✓ bot: botones, correcciones y seguridad (solo tu chat)');
