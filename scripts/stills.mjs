// Renderiza varios fotogramas de una vez (revisión rápida del diseño).
// Uso: node scripts/stills.mjs ResultsReel data/sample-results.json 40,200,330
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
const [id, dataFile, frames] = process.argv.slice(2);
const inputProps = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const browserExecutable = process.env.CHROME_PATH || undefined;
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id, inputProps, browserExecutable});
fs.mkdirSync('out', {recursive: true});
for (const f of frames.split(',').map(Number)) {
  const output = `out/${id}-${String(f).padStart(3, '0')}.png`;
  await renderStill({composition, serveUrl, inputProps, browserExecutable, frame: f, output});
  console.log('OK', output);
}
