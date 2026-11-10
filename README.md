# BOX BOX · reels de F1 (Remotion, 100 % local y gratis)

Estructura de la cuenta y reglas editoriales: **ESTRUCTURA.md**.

## Qué NO hace
No llama a ninguna IA ni API de pago. Todo son scripts de Node + Remotion en tu PC.
Claude solo hace falta para crear plantillas nuevas, no para generar vídeos con las que ya existen.

## Instalación (una vez)
    npm install

## Flujo diario
    npm run news      # descarga titulares → contrasta fuentes → renderiza reels → cola de revisión
    npm run review    # abre http://localhost:4173: ves, editas, apruebas, rechazas, borras y publicas

Otras series (las preparas tú, se renderizan gratis):
    node scripts/fetch-results.mjs data/results.json
    node scripts/enqueue.mjs ResultsReel data/results.json "Pie de foto"
    node scripts/enqueue.mjs DatoRapido data/sample-dato.json "Pie de foto"
    node scripts/enqueue.mjs DatoRapido data/sample-dato.json "Pie de foto"

## Fuentes y contraste
- `config/feeds.json`: medios (RSS). `config/people.json`: periodistas y creadores (Jorge Peiró, Elkaitz, Nachez…).
- Niveles: oficial · medio · periodista · creador. Para publicar hacen falta **2 fuentes independientes** (oficial/medio/periodista) o 1 oficial.
  Periodista + su medio = 1. Los creadores solo aparecen como "también lo comentan"; si solo hablan ellos, queda en **RADAR** (no se publica).
- X/Twitter no tiene lectura gratuita por API: añade pistas a mano con
      npm run add-lead -- "Jorge Peiró" "https://x.com/JPEIR0/status/..." "Texto del tuit"
- Canales de YouTube de creadores: en `people.json` pon `feed` = `https://www.youtube.com/feeds/videos.xml?channel_id=ID_DEL_CANAL`.
- La primera vez, `npm run fetch` muestra ✓/✗ por feed: corrige en `feeds.json` las URL que fallen.
- Prueba sin internet: `npm run test:news`.

## Publicar en Instagram (gratis)
1. Cuenta de Instagram **Business** (o Creator) + app de Meta en modo desarrollo, tu cuenta como "Instagram Tester".
2. Variables de entorno (PowerShell): `$env:IG_USER_ID="..."; $env:IG_ACCESS_TOKEN="..."; npm run review`
3. En el panel: **Aprobar** → **Publicar** (pide confirmación). Sin credenciales, el botón queda desactivado.

## Automatizar sin pagar nada
Programa solo la parte de preparar (nunca la de publicar). En Windows (Programador de tareas):
    schtasks /Create /SC DAILY /ST 09:00 /TN "BoxBox noticias" /TR "cmd /c cd /d C:\ruta\f1-reels && npm run news"
El PC debe estar encendido a esa hora. Luego abres `npm run review` cuando quieras.

## Espacio
Reglas en `config/settings.json → retention`. Botón "Limpiar espacio", 🗑 Borrar, o `npm run clean`.

## Estilo
Todo en `src/theme.ts` (marca, colores, tipografías) y `src/kit.tsx` (mascota, tarjetas, transiciones).
Previsualizar plantillas: `npx remotion studio src/index.ts`.

## Agentes de IA gratis (locales, 0 créditos)

`npm run agents` = investigador (RSS + cruce de fuentes) → guionista → verificador → locutor → animación/montaje → **cola de revisión** (nunca publica solo).

| Agente | Qué usa | Coste |
|---|---|---|
| Investigador | RSS + `cluster.mjs` (reglas, sin IA) | 0 |
| Guionista | **Ollama** local (`ollama pull qwen2.5:7b`); si no está, plantilla sin IA | 0 (tu GPU) |
| Verificador | `verify.mjs`: cifras y nombres del guion deben salir de los titulares; si no, se descarta | 0 |
| Locutor | **Piper** local + voz `es_ES-davefx-medium.onnx` en `voices/` (`PIPER_BIN`, `PIPER_VOICE`) | 0 |
| Animación + montaje | Remotion (audio + subtítulos por palabra, duración = audio) | 0 |

Flags: `--template` (sin LLM), `--no-voice`. Test: `npm run test:agents`. El guion generado aparece en la nota de cada elemento del panel.


## Flujo actual (borradores en la nube)
- **GitHub (sin que tengas el PC encendido):** `borradores.yml` lo lanza cron-job.org cada pocas horas. Guarda el registro de noticias y, si hay una buena, monta el vídeo (máx. 3 al día, `settings.drafts`) y lo sube a la release «borradores». No manda nada al móvil.
- **Tu PC:** `npm run review` baja los borradores solos (o con «⬇ Traer borradores»), los ves, editas texto/datos, apruebas y eliges: «📱 Al móvil» (Telegram) o «Publicar» (API de Meta, si hay credenciales).
- **Comando `npm run hoy`:** monta un vídeo a mano (noticia, tema o resumen) y abre el panel.
- Lo retirado está en `_to_delete/` (ignorado por git): alertas.yml, daily.yml, hoytoca.yml, daily.bat.
