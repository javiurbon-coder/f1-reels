// Agente "guionista". Usa Ollama LOCAL (gratis). Si no está, usa plantilla determinista (también gratis).
const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

const KEY = () => process.env.ANTHROPIC_API_KEY;
const CLAUDE = () => process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
export const llmName = () => (KEY() ? `Claude (${CLAUDE()})` : `Ollama (${MODEL})`);

/** Claude por API: solo se usa si existe el secreto ANTHROPIC_API_KEY (céntimos al mes). */
async function askClaude(system, user, {temperature = 0.2} = {}) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'x-api-key': KEY(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
    body: JSON.stringify({model: CLAUDE(), max_tokens: 1200, temperature, system, messages: [{role: 'user', content: user}]}),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return ((await r.json()).content ?? []).map((b) => b.text ?? '').join('').trim();
}

export async function ollamaAvailable() {
  if (KEY()) return true;
  try { return (await fetch(HOST + '/api/tags', {signal: AbortSignal.timeout(1500)})).ok; } catch { return false; }
}

/** Respuesta en streaming (así no hay límite de espera aunque la CPU sea lenta). */
export async function askLocal(system, user, {temperature = 0.2} = {}) {
  if (KEY()) return askClaude(system, user, {temperature});
  const r = await fetch(HOST + '/api/chat', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({model: MODEL, stream: true, options: {temperature}, messages: [{role: 'system', content: system}, {role: 'user', content: user}]}),
  });
  if (!r.ok) throw new Error('Ollama: ' + r.status);
  const dec = new TextDecoder();
  let buf = '', out = '';
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, {stream: true});
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line) out += JSON.parse(line).message?.content ?? '';
    }
  }
  return out.trim();
}

export const TRANSLATE = 'Traduce al español de España este texto sobre Fórmula 1. Mantén nombres propios, cifras y fechas exactamente. No añadas nada. Devuelve solo la traducción, sin comillas ni explicaciones.';

export const SYSTEM = `Eres el guionista de una cuenta de noticias de Fórmula 1 en español de España.
Escribe la locución de un reel de UN MINUTO (150-165 palabras; NUNCA menos de 140 palabras ni más de 170: el vídeo debe durar un minuto exacto). Usa TODO el material disponible para profundizar, sin inventar nada, tono directo, claro y cercano, SIEMPRE EN ESPAÑOL.
Estructura, con FRASES CORTAS (máximo 22 palabras cada una, una idea por frase): 1) frase de arranque potente; 2) qué ha pasado, con los detalles del material; 3) contexto: usa los DATOS CALCULADOS si te los doy (copia sus cifras tal cual, con números, p. ej. "7º", "3"), nada más; 4) por qué importa, SOLO si el material lo dice; 5) quién lo cuenta (una frase: "Lo cuentan A, B y C."); 6) cierre breve.
REGLAS ESTRICTAS:
- Usa SOLO información que esté en el material y en los DATOS CALCULADOS que te doy. No añadas cifras, nombres, causas ni contexto que no aparezcan en él.
- Cuenta la noticia en sí, con todo el detalle del material: qué ha pasado, cómo y qué implica. NO enumeres nombres de medios: salen en pantalla al final. Solo en la última frase di si lo confirma la fuente oficial o cuántos medios lo cuentan (por ejemplo: «Lo confirman tres medios»).
- No escribas direcciones web (como Formula1.com).
- No uses palabras en inglés salvo nombres propios. No digas "según mis datos". Sin emojis ni hashtags.
- Si es RUMOR, di desde el principio que NO está confirmado y que solo lo cuentan esas fuentes; nunca lo presentes como hecho.
- Devuelve únicamente el texto de la locución.`;

const sentences = (t) => (t.match(/[^.!?]+[.!?]+/g) ?? []).map((x) => x.trim()).filter((x) => x.length > 30);

/** Plantilla sin IA: siempre funciona y por construcción no inventa nada. Usa los resúmenes ya en español si los hay. */
export function templateScript(c, extra = []) {
  const head = c.headline.replace(/[.!?]+$/, '');
  // frases de detalle: sin repetir el titular ni entre sí, hasta llegar a ~30 s de locución
  const bag = (t) => new Set(t.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '').split(' ').filter((w) => w.length > 3));
  const like = (a, b) => { const A = bag(a), B = bag(b); return [...A].filter((w) => B.has(w)).length / Math.max(1, Math.min(A.size, B.size)); };
  const picked = [];
  for (const x of extra.flatMap(sentences)) {
    if (like(x, head) > 0.7 || picked.some((y) => like(x, y) > 0.7)) continue;
    picked.push(x);
    if (picked.join(' ').split(' ').length > 75 || picked.length >= 7) break;
  }
  const detail = picked.join(' ');
  if (c.level === 'RADAR') {
    const who = [...c.sources, ...(c.alsoSay ?? [])].map((s) => s.name).join(', ');
    return `Ojo, esto es un rumor y no está confirmado. ${head}. ${detail} Por ahora solo lo cuenta: ${who}. Si se confirma, te lo contamos.`.replace(/\s+/g, ' ');
  }
  const n = c.sources.length;
  const quien = c.level === 'OFICIAL' ? 'Lo confirma la fuente oficial.' : `Lo confirman ${n} medios distintos.`;
  return `${head}. ${detail} ${quien}`.replace(/\s+/g, ' ');
}

/** Frase final con QUIÉN lo cuenta. Se añade siempre que el guion no nombre ninguna fuente (los modelos a veces se la saltan). */
export function sourcesLine(c) {
  const names = (list) => list.map((s) => s.name).join(', ');
  if (c.level === 'RADAR') return `Por ahora solo lo cuenta: ${names([...c.sources, ...(c.alsoSay ?? [])])}. Si se confirma, te lo contamos.`;
  return c.level === 'OFICIAL' ? 'Lo confirma la fuente oficial.' : `Lo confirman ${c.sources.length} medios distintos.`;
}
