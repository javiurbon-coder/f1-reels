import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
for (const kind of process.argv.slice(2)) {
  const inputProps = {kind};
  const browserExecutable = process.env.CHROME_PATH || undefined;
  const composition = await selectComposition({serveUrl, id: 'Muestra', inputProps, browserExecutable});
  await renderStill({composition, serveUrl, inputProps, browserExecutable, frame: 130, output: `out/v2-${kind}.png`});
  console.log('OK', kind);
}
