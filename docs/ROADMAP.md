# Hoja de ruta

Plan aprobado el 2026-11-04. Cada fase cierra con: **qué se hizo · cómo probarlo · qué quedó pendiente**.

| # | Fase | Estado |
|---|---|---|
| 1 | **Base**: proyecto, auth, perfiles, modelo de datos con RLS, sistema de diseño, i18n | ✔ completa (+ ajustes del 2026-11-04: ver [DECISIONS](DECISIONS.md)) |
| 2 | **Juegos**: crear juego, subida directa, worker, reproductor seguro, versiones | siguiente |
| 3 | **Social**: avances, comentarios, me gusta, seguir, guardar, compartir, feed | |
| 4 | **Descubrimiento**: búsqueda, filtros, orden, Sorprendeme, juego de la semana, landing, seed completo | |
| 5 | **Confianza**: notificaciones, reportes, panel de admin, límites, páginas legales | |

## Arquitectura de alojamiento de juegos (Fase 2)

```
Navegador ──▶ Next.js (Vercel) ──▶ Supabase: Postgres+RLS · Auth · Realtime
   │  1 pide URL firmada ┘                       ▲  cola = tabla game_versions
   │  2 PUT del .zip directo                     │  (FOR UPDATE SKIP LOCKED)
   ▼                                             │
R2 quarantine (privado, vence a las 24 h)        │
   │  3 descarga el zip                          │
   ▼                                             │
Worker Python (Docker) ──────────────────────────┘
   │  4 valida → descomprime → sube con Content-Type/Encoding
   ▼
R2 games (privado) ◀─ binding ─ Gateway (Cloudflare Worker) ◀─ 5 <iframe sandbox>
                                {id}.GAMES_DOMAIN → games/{id}/v{n}/…
```

- **Python solo en el worker de subidas** (y herramientas de seed). Cola en Postgres con polling; rol de Postgres mínimo; contenedor endurecido.
- **R2 en 3 buckets**: `quarantine` (privado, expira en 24 h), `games` (privado: solo lo lee el gateway) y `media` (público, solo imagen/GIF/MP4, nunca HTML). Credenciales separadas.
- **R2 no soporta presigned POST**: se firma un PUT con tipo y tamaño y el worker **re-verifica el tamaño real** antes de descargar. El navegador pre-chequea con las mismas reglas (solo UX).
- **Gateway** (Cloudflare Worker): `*.GAMES_DOMAIN` → `games/{id}/v{n}/…`; aplica CSP, `Content-Type/Encoding` y bloquea la navegación directa. En local corre el mismo handler en Node contra un S3 local. *(Spike del S3 local **resuelto el 2026-11-04**: se usa el endpoint S3 de Supabase Storage, que ya viene en la pila local; MinIO quedó descartado por estar en modo mantenimiento. Verificado: PUT firmado desde el host, CORS, lectura pública, `Content-Type`/`Cache-Control`/`Content-Encoding`, borrado y tipos MIME por bucket. Detalles y la rareza del puerto en [DECISIONS](DECISIONS.md).)*

## Seguridad del alojamiento de juegos

- **Origen**: dominio registrable distinto + subdominio por juego (no por versión: las partidas guardadas sobreviven a las versiones). Pedir alta en la Public Suffix List cuando exista el dominio. **Elegir bien el dominio de juegos: cambiarlo resetea las partidas guardadas.**
- **iframe**: `sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-modals"` + `allow="fullscreen; autoplay; gamepad"`. Sin `allow-top-navigation`, `allow-popups`, `allow-forms` ni `allow-downloads`. `allow-same-origin` es necesario (IndexedDB/localStorage de los motores) y es seguro **solo porque** el origen del juego nunca es el del sitio.
- **Anti-phishing**: solo se sirve `games/…`; el HTML solo con `Sec-Fetch-Dest: iframe` (abrir la URL directo redirige a Trafal); CSP `connect-src 'self'; form-action 'none'; base-uri 'self'; object-src 'none'; frame-ancestors <SITE_URL>` (+ allowlist de CDNs), `nosniff`, sin CORS, Permissions-Policy cerrado, `410` inmediato al ocultar/eliminar.
- **Riesgo residual (se documenta)**: un juego puede navegar su propio iframe a otro sitio y mostrar un login falso dentro del marco. Mitigación: marco fijo de Trafal, reportes y baja rápida.
- **Prueba obligatoria**: `examples/malicious-game` + test e2e (cookies, localStorage, `window.top`, `fetch` con credenciales, popups, formularios, service workers).

## Reglas de subida (fuente única `packages/shared/upload-rules.json`)

- **Límites**: 200 MB el zip · 1 GB descomprimido · 5.000 archivos · 500 MB por archivo · rutas ≤ 240 caracteres. Se cuentan los bytes **realmente** descomprimidos.
- **Orden**: se valida el directorio central **antes de extraer**; solo si pasa todo se escribe en `games`. Un zip rechazado nunca toca el bucket público.
- **Rechazo**: `..`, rutas absolutas o con unidad, `\`, caracteres de control, symlinks, entradas cifradas, nombres duplicados por mayúsculas/Unicode, ejecutables (por extensión **o por magic bytes** MZ/ELF/Mach-O), zips anidados y extensiones fuera de la lista. Se ignoran sin error `__MACOSX/`, `.DS_Store`, `Thumbs.db`, `._*`. Si todo viene en una carpeta, se aplana; se exige `index.html` en la raíz.
- **Extensiones permitidas**: código y datos (`html htm js mjs cjs css json map wasm xml txt csv webmanifest`) · imágenes (`png jpg jpeg webp gif svg avif bmp ico cur ktx2 basis dds`) · audio/video (`mp3 ogg opus wav m4a aac flac mid mp4 webm ogv m4v`) · fuentes (`ttf otf woff woff2 eot`) · 3D (`glb gltf obj mtl bin`) · datos de motor (`data dat pck unx mem bytes unityweb unity3d`) · mapas/atlas (`atlas fnt tmx tsx`) · compresión (`br`/`gz` solo como segunda extensión, p. ej. `*.wasm.br`, servidos con `Content-Encoding`).
- **Errores** con código estable (`NO_INDEX_HTML`, `UNSAFE_PATH`, `TOO_LARGE`…) y mensaje para principiantes en es/en (el texto vive en i18n).
- **Escaneo básico**: magic bytes de ejecutables, heurísticas de phishing/minería en html/js (marcan `scan_flags` y van a la cola de admin sin bloquear), ClamAV opcional (apagado por defecto).

## Godot con hilos

Godot ≥ 4.3 puede exportar sin hilos (lo recomendado); 4.0–4.2 siempre los usan. Si el juego los necesita (`needs_isolation`), el botón pasa a «Abrir en pantalla completa»: ruta `/play/[slug]` de Trafal con COOP `same-origin` + COEP que embebe el juego (el gateway agrega COEP/CORP con un token firmado de vida corta). Plan B: abrir `{id}.GAMES_DOMAIN` en pestaña nueva con ese token. Se valida con un export real de Godot 4.2.

## Límites de los planes gratis (verificados en nov-2026)

| Servicio | Gratis incluye | Lo que limita |
|---|---|---|
| Cloudflare R2 | 10 GB-mes, 1 M escrituras, 10 M lecturas, descarga sin costo | Los juegos se guardan **descomprimidos**; luego ≈ US$0,015/GB-mes → cupos por usuario |
| Cloudflare Workers (gateway) | 100.000 requests/día | Cada carga de juego son varios requests; luego plan Workers Paid |
| Supabase | 500 MB de base, 2 proyectos | Se pausa tras 1 semana sin actividad; el mail integrado tiene tope por hora → SMTP propio al lanzar |
| Vercel Hobby | gratis | Solo uso personal/no comercial: al monetizar hace falta Pro |
| Worker Python | — | No tiene hogar gratis en Vercel/Cloudflare: contenedor con polling (Oracle Always Free, Fly.io, Railway, Render o servidor propio) — se decide al desplegar |
| Dominios | — | 2 dominios (sitio y juegos), pago anual |

## Decisiones menores adoptadas

Marca (wordmark `trafal.` + monograma pixel) · landing con datos reales (sin «38 creando ahora» ni toasts simulados; «Novedades» estático; el destacado lo elige el equipo) · jugar sin cuenta (me gusta, comentar, guardar y seguir requieren cuenta) · cupos por defecto configurables: 5 subidas/día, 10 juegos/usuario, 1 GB/usuario, imágenes ≤ 5 MB, GIF/MP4 ≤ 20 MB · versiones: `number` entero en la ruta (`v1`, `v2`…) y `label` editable («v0.3») · reproductor: aviso de sonido (no existe API para silenciar un iframe de otro origen), relación de aspecto elegible, overlay a pantalla completa donde no haya Fullscreen API · «no funciona» va al creador, el resto a la cola de admin · captcha Cloudflare Turnstile en registro y formulario de copyright.

## Riesgos que se validan primero (Fase 2)

1. ~~Un S3 local con PUT firmado, CORS y metadatos `Content-Encoding`~~ ✔ resuelto con Supabase Storage. Falta probar el worker Python (`boto3`) contra ese endpoint y crear el bucket `games` **sin** lista de tipos MIME (los juegos llevan `.wasm`, `.js`, `.html`…).
2. COOP/COEP con Godot 4.2 dentro de `/play`.
3. La CSP estricta contra exports reales (Phaser con CDN, Scratch, Twine, Construct).
4. Safari puede borrar el storage de un origen embebido tras ~7 días sin interacción: las partidas guardadas podrían perderse (se documenta).
