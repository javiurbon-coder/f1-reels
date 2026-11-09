// Uso:
//   node scripts/render.mjs ResultsReel data/results.json out/results.mp4
//   node scripts/render.mjs ResultsReel data/sample-results.json out/frame.png --still=300
import fs from 'node:fs';
import {renderFrame, renderVideo} from './lib/render.mjs';

const [id, dataFile, outFile, ...flags] = process.argv.slice(2);
if (!id || !dataFile || !outFile) {
  console.error('Uso: node scripts/render.mjs <Composición> <datos.json> <salida> [--still=N]');
  process.exit(1);
}
const props = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const still = flags.find((f) => f.startsWith('--still='));
if (still) await renderFrame({id, props, frame: Number(still.split('=')[1]), out: outFile});
else await renderVideo({id, props, out: outFile});
console.log('OK →', outFile);
