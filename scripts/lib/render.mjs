// Render local con Remotion (gratis, sin IA). Reutiliza el bundle entre llamadas.
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

let serveUrlPromise;
const getServeUrl = () => (serveUrlPromise ??= bundle({entryPoint: path.resolve('src/index.ts')}));
const browserExecutable = () => process.env.CHROME_PATH || undefined;

export async function renderVideo({id, props, out}) {
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({serveUrl, id, inputProps: props, browserExecutable: browserExecutable()});
  const tmp = out.replace(/\.mp4$/, '.tmp.mp4'); // si se corta, no queda un MP4 a medias con el nombre final
  await renderMedia({
    composition, serveUrl, inputProps: props, browserExecutable: browserExecutable(),
    codec: 'h264', crf: 20, pixelFormat: 'yuv420p', outputLocation: tmp,
    // faststart: Instagram exige el átomo moov al principio
    ffmpegOverride: ({args}) => [...args.slice(0, -1), '-movflags', '+faststart', ...args.slice(-1)],
  });
  fs.renameSync(tmp, out);
  return out;
}

export async function renderFrame({id, props, frame, out}) {
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({serveUrl, id, inputProps: props, browserExecutable: browserExecutable()});
  await renderStill({composition, serveUrl, inputProps: props, browserExecutable: browserExecutable(), frame, output: out, ...(out.endsWith('.jpg') ? {imageFormat: 'jpeg', jpegQuality: 82} : {})});
  return out;
}
