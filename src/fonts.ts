import {continueRender, delayRender} from 'remotion';
import archivo from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2';
import mono400 from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2';
import mono700 from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2';

// Se cargan a nivel de módulo: Remotion espera a que terminen antes de pintar el primer frame.
const handle = delayRender('fuentes');
const faces = [
  new FontFace('Archivo Black', `url(${archivo})`, {weight: '400'}),
  new FontFace('Space Mono', `url(${mono400})`, {weight: '400'}),
  new FontFace('Space Mono', `url(${mono700})`, {weight: '700'}),
];
Promise.all(faces.map((f) => f.load().then((l) => document.fonts.add(l))))
  .then(() => continueRender(handle))
  .catch((e) => {
    console.error(e);
    continueRender(handle);
  });
