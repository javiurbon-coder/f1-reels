// Guarda archivos de estado en git sin fallar si otro workflow tocó el mismo archivo a la vez:
// si hay conflicto, fusiona los dos JSON (lo que cambió cada uno) y reintenta.
// Uso: node scripts/bot/push-state.mjs "mensaje" archivo1.json [archivo2.json …]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const git = (...a) => execFileSync('git', a, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const ok = (...a) => { try { git(...a); return true; } catch { return false; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function merge(base, mine, theirs) {
  if (isObj(base) && isObj(mine) && isObj(theirs)) {
    const out = {...theirs};
    for (const k of new Set([...Object.keys(base), ...Object.keys(mine)])) {
      if (same(mine[k], base[k])) continue;                       // yo no lo toqué: me quedo con lo del otro
      if (same(theirs[k], base[k]) || theirs[k] === undefined) { if (mine[k] === undefined) delete out[k]; else out[k] = mine[k]; }
      else out[k] = merge(base[k], mine[k], theirs[k]);          // lo tocamos los dos: se fusiona por dentro
    }
    return out;
  }
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const s = new Set(theirs.map((x) => JSON.stringify(x)));
    return [...theirs, ...mine.filter((x) => !s.has(JSON.stringify(x)))];
  }
  return mine;
}

const read = (ref, f) => { try { return JSON.parse(git('show', `${ref}:${f}`)); } catch { return undefined; } };

if (process.argv[1] && process.argv[1].endsWith('push-state.mjs')) {
  const [msg, ...files] = process.argv.slice(2);
  git('config', 'user.name', 'f1-reels-bot'); git('config', 'user.email', 'bot@users.noreply.github.com');
  git('add', ...files);
  if (ok('diff', '--cached', '--quiet')) { console.log('Sin cambios que guardar.'); process.exit(0); }
  git('commit', '-m', msg);
  for (let i = 1; i <= 5; i++) {
    if (ok('pull', '--rebase', '-q') && ok('push')) { console.log(`✓ estado guardado (intento ${i})`); process.exit(0); }
    ok('rebase', '--abort');
    console.log(`Choque al guardar (intento ${i}): fusiono los cambios y reintento.`);
    git('fetch', 'origin', 'main');
    const merged = {};
    for (const f of files) {
      const mine = read('HEAD', f), base = read('HEAD~1', f) ?? {}, theirs = read('origin/main', f);
      merged[f] = theirs === undefined ? fs.readFileSync(f, 'utf8') : mine === undefined ? JSON.stringify(theirs, null, 2) : JSON.stringify(merge(base, mine, theirs), null, 2);
    }
    git('reset', '--hard', 'origin/main');
    for (const f of files) fs.writeFileSync(f, merged[f]);
    git('add', ...files);
    if (!ok('diff', '--cached', '--quiet')) git('commit', '-m', msg);
    else { console.log('Tras fusionar no queda nada por guardar.'); process.exit(0); }
  }
  console.error('✗ No se pudo guardar el estado tras 5 intentos.'); process.exit(1);
}
