# Estructura de la cuenta de Instagram (BOX BOX · F1) — noticias del mundo de la F1

Regla de oro: **cada vídeo pertenece a UNA serie**, y cada serie tiene su plantilla, su fuente de datos y su sitio en el perfil.
Todo son plantillas de texto/datos (sin ilustraciones técnicas), así los agentes las rellenan sin que se vean mal.

## Las 6 series

| Serie | Qué es | Frecuencia | Plantilla | Fuente (automática) |
|---|---|---|---|---|
| **Última hora** | Noticia confirmada por 2+ fuentes (o 1 oficial) | máx. 1 al día | `NoticiaVerificada` | RSS + cruce de fuentes |
| **Resultados** | Podio y top 10 tras clasificación y carrera | 2 por GP | `ResultsReel` | API Jolpica (`fetch-results`) |
| **Mercado** | Fichajes, renovaciones, salidas, contratos (confirmados) | cuando haya | `Mercado` | mismas noticias, filtradas por palabras de mercado |
| **Esta semana** | Previa del GP: nombre, circuito, horarios en hora de España | 1 por GP (lunes) | `EstaSemana` | API Jolpica (`npm run semana`) |
| **Rumor o realidad** | Un rumor, SIEMPRE con sello NO CONFIRMADO y quién lo cuenta | máx. 1/semana | `Rumor` | lo que antes quedaba en "radar" |
| **Dato rápido** | Una cifra con contexto | 2 por semana | `DatoRapido` | tú (JSON) |


### Semana tipo
- **Lunes:** Esta semana (previa del GP).
- **Mar-Jue:** 1 Última hora al día (solo si hay noticia contrastada).
- **Vie:** Mercado o Rumor o realidad.
- **Sáb/Dom:** Resultados de clasificación y de carrera + reacciones.

## Cómo se reparte cada noticia (sin IA, `scripts/lib/classify.mjs`)
1. Nivel RADAR (sin confirmar) → **Rumor** (máx. `rumors.maxPerRun`, apágalo con `rumors.enabled: false`).
2. Titular con palabras de mercado (ficha, renueva, contrato, signs, extends…) → **Mercado**.
3. El resto → **Última hora**.

## Perfil de Instagram
- **Nombre:** `BOX BOX · F1` (cámbialo en `src/theme.ts`).
- **Bio (3 líneas):** `Noticias de F1 contrastadas con fuentes` / `Mercado · Resultados · Rumores marcados como tal` / `Nuevo reel cada día`.
- **Destacados (uno por serie):** Noticias · Resultados · Mercado · Calendario · Rumores · Fuentes. Portada de cada uno con la mascota y el color de la serie.
- **Fijados (3):** (1) "De qué va esta cuenta", (2) una noticia verificada con sus fuentes, (3) un Rumor o realidad.
- **Cuadrícula coherente:** todos los vídeos abren con la misma cabecera (mascota + marca + sello de la serie) y el primer fotograma ya lleva el titular, así la miniatura siempre se lee. Colores por serie: negro = Última hora/Dato, amarillo = Resultados/Rumor, rojo = Mercado, azul = Esta semana.

## Reglas editoriales (lo que da credibilidad)
1. **Noticia = al menos 2 fuentes independientes** (oficial, medio o periodista). Un periodista y su propio medio cuentan como UNA.
2. **Streamers/YouTubers/Twitch:** nunca confirman por sí solos; salen como "también lo comentan". Si solo hablan ellos → queda en **RADAR** y no se publica.
3. **Rumores:** nunca como noticia. Solo en la serie *Rumor o realidad*, con el sello NO CONFIRMADO y la lista de quién lo cuenta.
4. **Siempre las fuentes visibles** en el vídeo y en el pie de foto con enlace.
5. **Reescribe el titular** con tus palabras en el panel (los titulares en inglés avisan de que hay que traducirlos).
6. **Correcciones:** si te equivocas, borra o publica corrección el mismo día.
7. Un humano (tú) aprueba **todo** antes de publicar: el panel no publica nada solo.

## Espacio en disco
- Un reel pesa ≈ 2-5 MB. Con las reglas de `config/settings.json → retention`:
  rechazados se borran al día, pendientes sin revisar a los 7 días, y de los publicados se borra el vídeo a los 2 días (queda la ficha y la miniatura).
- Botón **Limpiar espacio** en el panel, 🗑 **Borrar** en cada vídeo, y limpieza automática cada vez que abres el panel o ejecutas `npm run clean`.
- Bonus: si publicas desde el panel y quieres liberar al instante, pon `publishedKeepVideoDays` a 0.
