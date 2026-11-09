// Mete cualquier serie en la cola de revisión (resultados, aero, dato rápido...).
// Uso: node scripts/enqueue.mjs <Composición> <datos.json> "<caption>" [id]
//   node scripts/enqueue.mjs DatoRapido data/sample-dato.json "Pie de foto #F1"
import fs from 'node:fs';
import {enqueue} from './lib/queue.mjs';

const [composition, dataFile, caption = '', idArg] = process.argv.slice(2);
if (!composition || !dataFile) {
  console.error('Uso: node scripts/enqueue.mjs <Composición> <datos.json> "<caption>" [id]');
  process.exit(1);
}
const props = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const id = idArg ?? `${composition.toLowerCase()}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
const r = await enqueue({id, composition, props, caption});
console.log(r.skipped ? `Ya existía: ${id}` : `OK → en cola: ${id}. Ejecuta: npm run review`);
