// Agente "guionista". Usa Ollama LOCAL (gratis, tu GPU). Si no está, usa plantilla determinista (también gratis).
const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

export async function ollamaAvailable() {
  try { return (await fetch(HOST + '/api/tags', {signal: AbortSignal.timeout(1500)})).ok; } catch { return false; }
}

export async function askLocal(system, user) {
  const r = await fetch(HOST + '/api/chat', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({model: MODEL, stream: false, options: {temperature: 0.2}, messages: [{role: 'system', content: system}, {role: 'user', content: user}]}),
  });
  if (!r.ok) throw new Error('Ollama: ' + r.status);
  return (await r.json()).message.content.trim();
}

export const SYSTEM = `Eres el guionista de una cuenta de noticias de Fórmula 1 en español de España.
Escribe la locución de un reel de 20-25 segundos (45-65 palabras), tono directo y cercano.
REGLAS ESTRICTAS:
- Usa SOLO información que esté en los titulares que te doy. No añadas cifras, nombres, causas ni contexto que no aparezcan en ellos.
- Si es OFICIAL di que lo confirma la fuente oficial; si no, di cuántos medios lo cuentan.
- No digas "según mis datos". No uses emojis ni hashtags. Una sola frase de arranque potente.
- Si es RUMOR, di desde el principio que NO está confirmado y que solo lo cuentan esas fuentes; nunca lo presentes como hecho.
- Devuelve únicamente el texto de la locución.`;

/** Plantilla sin IA: siempre funciona y por construcción no inventa nada. */
export function templateScript(c) {
  if (c.level === 'RADAR') {
    const who = [...c.sources, ...(c.alsoSay ?? [])].map((s) => s.name).join(', ');
    return `Ojo, esto es un rumor y no está confirmado. ${c.headline.replace(/[.!?]+$/, '')}. Por ahora solo lo cuenta: ${who}. Si se confirma, te lo contamos.`;
  }
  const n = c.sources.length;
  const quien = c.level === 'OFICIAL' ? `Lo confirma ${c.sources[0].name}, fuente oficial.` : `Lo cuentan ${n} medios distintos: ${c.sources.map((s) => s.name).join(', ')}.`;
  return `${c.headline.replace(/[.!?]+$/, '')}. ${quien} Te dejamos las fuentes en la descripción.`;
}
