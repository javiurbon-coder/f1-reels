// Agente "guionista". Usa Ollama LOCAL (gratis). Si no está, usa plantilla determinista (también gratis).
const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

export async function ollamaAvailable() {
  try { return (await fetch(HOST + '/api/tags', {signal: AbortSignal.timeout(1500)})).ok; } catch { return false; }
}

/** Respuesta en streaming (así no hay límite de espera aunque la CPU sea lenta). */
export async function askLocal(system, user, {temperature = 0.2} = {}) {
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
Escribe la locución de un reel de 35-45 segundos (95-120 palabras), tono directo, claro y cercano, SIEMPRE EN ESPAÑOL.
Estructura: 1) frase de arranque potente; 2) qué ha pasado, con los detalles del material; 3) por qué importa, SOLO si el material lo dice; 4) quién lo cuenta; 5) cierre breve.
REGLAS ESTRICTAS:
- Usa SOLO información que esté en el material que te doy. No añadas cifras, nombres, causas ni contexto que no aparezcan en él.
- Si es OFICIAL di que lo confirma la fuente oficial; si no, di cuántos medios lo cuentan.
- No uses palabras en inglés salvo nombres propios. No digas "según mis datos". Sin emojis ni hashtags.
- Si es RUMOR, di desde el principio que NO está confirmado y que solo lo cuentan esas fuentes; nunca lo presentes como hecho.
- Devuelve únicamente el texto de la locución.`;

const sentences = (t) => (t.match(/[^.!?]+[.!?]+/g) ?? []).map((x) => x.trim()).filter((x) => x.length > 30);

/** Plantilla sin IA: siempre funciona y por construcción no inventa nada. Usa los resúmenes ya en español si los hay. */
export function templateScript(c, extra = []) {
  const head = c.headline.replace(/[.!?]+$/, '');
  const detail = extra.flatMap(sentences).slice(0, 4).join(' ');
  if (c.level === 'RADAR') {
    const who = [...c.sources, ...(c.alsoSay ?? [])].map((s) => s.name).join(', ');
    return `Ojo, esto es un rumor y no está confirmado. ${head}. ${detail} Por ahora solo lo cuenta: ${who}. Si se confirma, te lo contamos.`.replace(/\s+/g, ' ');
  }
  const n = c.sources.length;
  const quien = c.level === 'OFICIAL' ? `Lo confirma ${c.sources[0].name}, fuente oficial.` : `Lo cuentan ${n} medios distintos: ${c.sources.map((s) => s.name).join(', ')}.`;
  return `${head}. ${detail} ${quien} Te dejamos las fuentes en la descripción.`.replace(/\s+/g, ' ');
}
