// Verificador DETERMINISTA (sin IA): el guion solo puede contener cifras y nombres propios
// que aparezcan en los titulares de las fuentes. Si el modelo se inventa algo, se descarta.
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set('el la los las un una de del al y o en que se por con para su sus es son fue ha han lo le les mas pero como este esta esto ya si no tras sobre entre hasta desde segun'.split(' '));

export function checkScript(script, sourceTitles, {minWords = 15, maxWords = 75} = {}) {
  const corpus = norm(sourceTitles.join(' \n '));
  const problems = [];
  const clean = script.replace(/\S+\.(?:com|es|org|net|uk)\b\S*/gi, ' '); // las direcciones web no cuentan como cifras ni nombres
  for (const n of clean.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    if (!corpus.includes(n.replace(',', '.')) && !corpus.includes(n)) problems.push(`cifra "${n}" no aparece en las fuentes`);
  }
  // palabras con mayúscula que no abren frase = nombres propios
  const sentences = clean.split(/(?<=[.!?¡¿])\s+/);
  for (const s of sentences) {
    const words = s.replace(/[¡¿]/g, '').split(/\s+/).filter(Boolean);
    words.forEach((w, i) => {
      const bare = w.replace(/[^\p{L}\d-]/gu, '');
      if (/[\p{L}\d]\.[a-z]{2,}/iu.test(w)) return; // direcciones web (Formula1.com): no son nombres propios
      if (i === 0 || bare.length < 3 || !/^\p{Lu}/u.test(bare) || /^[\p{Lu}\d]+$/u.test(bare) && bare.length < 3) return;
      if (STOP.has(norm(bare))) return;
      if (!corpus.includes(norm(bare))) problems.push(`nombre "${bare}" no aparece en las fuentes`);
    });
  }
  const wc = script.split(/\s+/).filter(Boolean).length;
  if (wc < minWords) problems.push('demasiado corto');
  if (wc > maxWords) problems.push(`demasiado largo (>${maxWords} palabras)`);
  return {ok: problems.length === 0, problems, words: wc};
}

const ES = new Set('el la los las de del y en que un una por con para es se su sus al lo como mas pero ya fue han ha este esta tras sobre entre hasta desde segun'.split(' '));
const EN = new Set('the of and to in is was were for on at with by from as it its that this after before over has have had will are'.split(' '));
/** ¿Está en español? (palabras vacías: muchas en español y pocas en inglés) */
export function isSpanish(text) {
  const w = norm(text).split(/[^a-z]+/).filter(Boolean);
  if (w.length < 4) return false;
  const es = w.filter((x) => ES.has(x)).length / w.length;
  const en = w.filter((x) => EN.has(x)).length / w.length;
  return es >= 0.15 && en < 0.08;
}
