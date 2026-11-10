// AGENTE DE CONTROL DE CALIDAD (sin IA). Devuelve los problemas del storyboard; lista vacía = bien.
// Los solapes de texto se evitan por construcción (cada texto se ajusta a su caja en src/fit.ts);
// aquí se vigilan duración mínima, ritmo y datos.
export const MIN_SECONDS = 30;
const DATA = ['dato', 'bars', 'rank', 'streak', 'stat', 'resultado'];
export function qa({scenes, total}, {minTotal = MIN_SECONDS, minScene = 1.8} = {}) {
  const p = [];
  if (!scenes?.length) return {problems: ['sin escenas'], dataScenes: 0};
  if (total < minTotal) p.push(`vídeo corto (${total.toFixed(0)} s < ${minTotal} s)`);
  if (scenes[0].from !== 0) p.push('la primera escena no empieza en 0');
  scenes.forEach((s, i) => {
    const d = s.to - s.from;
    const max = s.type === 'list' ? 24 : s.type === 'point' ? 13 : 14;
    if (i > 0 && Math.abs(s.from - scenes[i - 1].to) > 0.05) p.push(`hueco antes de la escena ${i + 1}`);
    if (d < minScene) p.push(`escena ${i + 1} (${s.type}) muy corta: ${d.toFixed(1)} s`);
    if (d > max) p.push(`escena ${i + 1} (${s.type}) muy larga: ${d.toFixed(1)} s (se vería quieta)`);
    if (s.type === 'point' && (s.text?.length ?? 0) > 125) p.push(`texto demasiado largo en escena ${i + 1}`);
    if (s.type === 'list' && (s.rows.length < 1 || s.rows.length > 4)) p.push(`lista con ${s.rows.length} filas en escena ${i + 1}`);
    if ((s.type === 'bars' || s.type === 'rank') && (s.rows.length < 2 || s.rows.length > 6)) p.push('gráfica con filas fuera de 2-6');
    if (s.type === 'dato' && !/\d/.test(s.value)) p.push('dato sin cifra');
    if (s.type === 'stat' && !Number.isFinite(s.value)) p.push('número no válido en escena stat');
  });
  return {problems: p, dataScenes: scenes.filter((s) => DATA.includes(s.type)).length};
}
