// IDENTIDAD DE LA CUENTA. Cambiar este archivo cambia el aspecto de todos los reels.
export const theme = {
  width: 1080,
  height: 1920,
  fps: 30,

  brand: 'CONTRASTADO F1',
  handle: '@contrastadof1',

  // color
  cream: '#f6e8c8',
  ink: '#111111',
  yellow: '#ffd21f',
  red: '#ff3b1d',
  white: '#ffffff',
  blue: '#2b6cff',
  muted: '#6b6252',
  mint: '#7fe3b8',
  mint2: '#a9f0d0',
  sky: '#8ec9ff',
  sky2: '#bfe0ff',
  pink: '#ff5fa2',
  green: '#1fa95b',
  gold: '#ffd21f',
  silver: '#d9dde3',
  bronze: '#e8a46a',

  // tipografía
  display: '"Archivo Black", Impact, sans-serif',
  body: '"Archivo", Arial, sans-serif',
  mono: '"Space Mono", "DejaVu Sans Mono", monospace',

  // formas
  border: 7,
  shadow: 14, // desplazamiento de la sombra dura
  radius: 26,

  // zonas seguras de Instagram (px): la interfaz tapa arriba y abajo
  safeTop: 170,
  safeBottom: 330,
  safeX: 64,

  spring: {damping: 13, stiffness: 150, mass: 0.7},
};
export type Theme = typeof theme;
