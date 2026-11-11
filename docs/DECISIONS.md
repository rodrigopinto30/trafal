# Decisiones de diseño

Registro corto de lo que se decidió y por qué. Las decisiones grandes de arquitectura están en [ARQUITECTURA.md](ARQUITECTURA.md).

## Fase 1 · Base

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Esquema completo con RLS desde la Fase 1** (22 tablas) | Los permisos son lo más caro de arreglar tarde; así cada fase construye sobre una base ya probada. | Las fases siguientes agregan funciones/triggers, no rehacen permisos. |
| **Los admins no escriben tablas: solo funciones auditadas** | Una sola vía de moderación, con registro inmutable; un token de admin robado no puede editar a mano. | Fase 5 implementa esas funciones. |
| **i18n propio sobre `next/root-params`** (sin next-intl) | next-intl resuelve el idioma con `headers()`, que no se puede usar en el caparazón estático de Cache Components; la guía oficial de Next 16 recomienda este patrón. | `src/i18n/` (~300 líneas, 40+ tests). Los componentes de cliente solo usan los namespaces de `CLIENT_NAMESPACES`. |
| **Español sin prefijo, inglés en `/en`** | Español rioplatense es el idioma principal; URLs limpias. | El `proxy` reescribe `/login → /es/login`; la elección vive en una cookie (la fija *Configuración*); sin cookie usa `Accept-Language`. |
| **Cache Components + prefetch parcial activados** | Es el modelo por defecto de Next 16 y de la próxima versión mayor; da el caparazón instantáneo que pide el objetivo de Lighthouse. | Todo lo que lee cookies/params va dentro de `<Suspense>`; `next build` lo exige. |
| **`createClient()` llama a `connection()`** | Sin eso, el prefetch parcial intenta pre-renderizar código que lee la sesión (cada prefetch dejaba un error en el log). | La lectura de sesión solo ocurre con una persona real. |
| **Validación «instant navigation» de desarrollo en modo manual** | Es experimental, no puede renderizar nuestro layout y llenaba el log y el overlay de falsos positivos. El chequeo del *build* sigue activo. | `experimental.instantInsights.validationLevel = "manual-warning"` en `next.config.ts`. |
| **Contraseñas en estado controlado del cliente** | React 19 vacía los campos no controlados al terminar una acción; la contraseña nunca vuelve del servidor. | Un error de validación no hace perder lo tipeado. |
| **Lista de países armada en el servidor** | Node y los navegadores tienen datos ICU distintos: calcularla en el cliente rompía la hidratación (y se perdía lo escrito). | Se pasa como datos al formulario. |
| **Redirecciones de `/auth/*` a `SITE_URL`, no a `request.nextUrl.origin`** | Dentro de Docker ese origen es `0.0.0.0:3000`; redirigir a otro host hace que el navegador no envíe la cookie de sesión. | `SITE_URL` es obligatoria y correcta en cada entorno. |
| **Links de mails con `token_hash`, no PKCE** | Funciona aunque se abra el mail en otro dispositivo. | Plantillas propias en `supabase/templates/` (bilingües). |
| **Casilla de 18+ y términos en el registro, y de nuevo en el onboarding si se entró con Google** | Se frena antes de recolectar datos; no se pide fecha de nacimiento (menos datos personales). Era 13+; pasó a 18+ el 2026-11-04. | Se guarda versión y fecha de aceptación en `profile_private`. «Más de 18 años» se interpretó como **18 o más** (mayoría de edad). La versión de términos subió a `2026-11-04`. |
| **@usuario inmutable** | Los links `/u/@usuario` no se rompen. | Cambiarlo, si hiciera falta, es una función con tope de frecuencia (futuro). |
| **Avatar: la foto si la subió; si no, letra de colores** (degradé por usuario) | Una cuenta nueva ya tiene un avatar presentable sin subir nada. | Ver «Ajustes previos a la Fase 2». |
| **Etiquetas violeta con texto oscuro** (no blanco como la maqueta) | Blanco sobre `#8B5CFF` da 4,14:1; el requisito es ≥ 4,5:1. | Documentado por un test de contraste. |
| **Controles de 44 px** (la maqueta tenía chips de 34–40 px) | Requisito de accesibilidad del brief. | Probado en Playwright en 10 pantallas × 2 tamaños. |
| **`./pnpm` y `./check.sh`** | El host tiene Node 18 y Python 3.10: nada del proyecto depende de lo que haya instalado. | Solo hace falta Docker. |
| **Tests e2e en la imagen oficial de Playwright** | Mismos navegadores en cualquier máquina. | `./e2e/run.sh`; limpia las cuentas `e2e_*` al terminar. |

## Ajustes previos a la Fase 2 (2026-11-04)

Cambios pedidos antes de empezar la Fase 2 (los siete primeros, y después el menú de arriba). Migración: [`20261104000700_profile_polish.sql`](../supabase/migrations/20261104000700_profile_polish.sql) (nueva: `./start.sh` la aplica sola sobre la base que ya tenés).

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Sin selector de idioma visible**: el idioma sale del sistema y se cambia en *Configuración → Preferencias* | Menos ruido en la barra; quien llega con el navegador en inglés ya lo ve en inglés. | Sin cuenta: `Accept-Language` (o `/en` a mano). Con cuenta: queda en `profile_private.locale` **y** en la cookie, y al iniciar sesión (contraseña, mail o Google) el idioma de la cuenta gana al del navegador (`lib/auth/locale.ts`). |
| **Manito (`cursor: pointer`) en todo lo clickeable, con las reglas CSS fuera de `@layer`** | La flecha lima propia no se leía como «clickeable», y varios elementos ni la tenían: los chips (`<label>` sin `for`) y los ítems de menú de shadcn, que traen la utilidad `cursor-default`. Lo que no está en una capa le gana a las utilidades de Tailwind. | `globals.css`, sección CURSOR. La flecha pixelada cian sigue siendo el cursor general. `cursor.spec.ts` mide el cursor **real** en 9 pantallas, el menú de la cuenta, las pestañas y el diálogo de la foto (se verificó rompiendo la regla a propósito). |
| **Registro: 18 años o más por declaración + repetir la contraseña** | Pedido del producto. No se pide fecha de nacimiento. | `MIN_AGE` en `lib/auth/terms.ts`; la contraseña repetida se valida en el servidor (`signupSchema`). |
| **Todo dato que llega del navegador pasa por Zod** (`src/lib/validation/`) | La validación que vale es la del servidor; antes era manual y dispersa. | Formularios, argumentos de Server Actions, `searchParams`, params de ruta y query de `/auth/*`. El `message` de cada regla es una **clave de i18n**: `fieldErrorsFrom` la traduce y nunca muestra el texto técnico de Zod. El texto libre se sanea (`sanitizeLine`/`sanitizeMultiline`: NFC, sin caracteres de control ni invisibles/bidireccionales). Las contraseñas se miden en **bytes** (bcrypt corta en 72) y no se recortan. |
| **@usuario: si está libre y es razonable, se puede usar** | La regla vieja (3–20, empezar y terminar con letra o número, sin `__` ni `_.`) rechazaba nombres comunes, y el texto de ayuda hacía pensar que hacían falta números. | 3–30 caracteres, `a-z 0-9 _ .`, el punto no va al principio/final/repetido, al menos una letra o número. Se normaliza (minúsculas, **sin acentos**: «Ñandú» → `nandu`) y se le avisa cuál se guarda. Reservados: solo los que permiten hacerse pasar por el equipo (22; ya no las rutas, porque los perfiles viven en `/u/`). Si está ocupado, se sugieren alternativas libres **sin números**. La regla vive en **una** función SQL (`private.is_valid_username`) usada por el CHECK, `username_available` y `complete_onboarding`; un test la compara con el espejo en TypeScript. |
| **Configuración: pestañas arriba y tarjetas de 920 px** (el ancho de la tarjeta del perfil) | La tarjeta de 480 px era muy chica; con un menú lateral seguía en ~690 px. | `/settings/profile` y `/settings/preferences` comparten el marco de 960 px. En pantallas anchas «Sobre vos» va en dos columnas. |
| **Géneros favoritos** (`profiles.favorite_genres`) | Que la comunidad conozca los gustos de cada persona; base para recomendaciones futuras (fuera del MVP). | Reutiliza el catálogo `genres`, ampliado a 17 (estrategia, disparos, simulación, deportes, lucha, incremental). Un trigger descarta repetidos y valida contra el catálogo. Grilla de baldosas-casilla: tocar elige, tocar de nuevo saca. |
| **Foto de perfil por la API S3, subida mediada por el servidor** | Avatares chicos (256 px, ≤ 200 KB): conviene que el servidor **inspeccione los bytes** antes de guardarlos, algo que una URL firmada no permite. Las URL firmadas quedan para los juegos (Fase 2), que van a cuarentena y los revisa el worker. | El navegador recorta y achica a 256×256 (WebP; JPEG si el navegador no sabe codificar WebP). El servidor **no se fía**: tipo real por cabecera (`inspectImage`), tamaño exacto, sin animación, sin datos pegados al final, nombre aleatorio dentro de `avatars/<tu id>/`; recién entonces sube y guarda la ruta. La base valida la ruta con un CHECK (solo tu carpeta, solo webp/jpg/png). La foto anterior se borra. |
| **Almacenamiento local = el S3 de Supabase Storage** (resuelve el spike de la Fase 2) | Hace de Cloudflare R2: la app habla S3 en los dos casos. Verificado: PUT firmado desde el host, CORS, lectura pública, `Content-Type`/`Cache-Control`/`Content-Encoding`, borrado y lista de tipos MIME por bucket. | `[storage]` en `supabase/config.toml` (bucket `media`, público, solo imagen/video). `./start.sh` siembra el bucket y deja las credenciales S3 en `.env.supabase`. **Rareza local**: Kong reenvía `X-Forwarded-Port: 54321` y Storage firma con host:puerto, por eso el servidor entra por `host.docker.internal:54321` y no por `supabase_kong_trafal:8000`. |
| **Checkbox nativo (no el de Radix) y `defaultChecked` desde `state.values`** | React 19 resetea el formulario al terminar una Server Action; el `Checkbox` de Radix escucha el reset y se **desmarca solo**, y una casilla *controlada* también vuelve a su valor inicial. Con «las contraseñas no coinciden» como error común, había que volver a aceptar los términos cada vez. | `components/ui/checkbox.tsx`. Patrón para casillas y chips: no controlados, con el valor que devuelve el servidor; contraseñas: controladas. |
| **Menú de arriba mínimo: solo «Subir juego» y «Comunidad»** (además del logo y la cuenta) | Pedido del producto: una barra simple con las dos acciones que importan. | `NAV_ITEMS` en `nav-config.ts` alimenta la barra y el menú del celular. «Explorar» y «Creadores» siguen existiendo como rutas y en el pie, pero ya no en la barra. `nav.spec.ts` comprueba que haya exactamente esos dos links, en español e inglés, en escritorio y celular. |
| **Nada de caracteres invisibles o de dirección de escritura literales en el código** | «Trojan Source» (CVE-2021-42574) y U+2028/U+2029, que cortan líneas en JavaScript sin que se vea. | `source-hygiene.test.ts` falla si aparece uno en `src/`; en el código se escriben como secuencias de escape. |

## Portada con juegos y comunidad (2026-11-05)

La portada pasó de ser un texto de presentación a mostrar juegos, banners y mensajes de la comunidad. Sin migración nueva.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Datos de ejemplo en `supabase/seeds/`** (10 cuentas, 16 juegos, 30 avances, 31 comentarios, 40 me gusta) | La portada, la página del juego y el perfil necesitan contenido real para diseñarse y probarse; el brief pedía 10 usuarios, 16 juegos y 30 avances. Los 16 juegos salen de la maqueta de diseño original (nombres, creadores, motores, géneros), con descripción y «cómo se juega» escritos como guía. | Tres archivos que corren en orden (`01-usuarios`, `02-juegos`, `03-comunidad`). Las partidas, los me gusta y los guardados que se ven son números fijados a mano en el último archivo: la base no tiene aún funciones que los cuenten. Solo local. |
| **Cada tarjeta lleva a la página del juego** (`/games/<public_id>`); el reproductor real llega con la Fase 2 | Se pidió poder entrar sin cuenta; el reproductor seguro (subida, worker, dominio aparte) es el trabajo de la Fase 2. | La página ya muestra descripción, cómo se juega, avances, comentarios e invitación a registrarse, y un marco con la proporción del juego que avisa que el reproductor está en camino (botón de jugar desactivado). En el seed los `public_id` son legibles (`orbita`); en producción son aleatorios de 12 caracteres. |
| **Portadas generadas** (`lib/games/cover.ts`) hasta que cada creador suba la suya | No hay imágenes que sembrar ni almacenamiento de portadas todavía. | Degradé por género + destello + ícono, determinístico por juego. `GameCover` usa la imagen (`cover_path`) apenas exista. Los colores viven en TypeScript, igual que los degradés de avatar. |
| **Una sola tanda de consultas por portada** y secciones armadas en memoria (`lib/games/sections.ts`) | Son pocos juegos y 4 consultas en paralelo bastan; la lógica pura se prueba sin base. | Cuando haya cientos de juegos, cada sección pasa a su propia consulta con tope y orden en SQL (Fase 4). |
| **Filas de tarjetas deslizables en celular y grilla desde 768 px** | Ocho tarjetas apiladas hacían la portada interminable en 360 px. | CSS puro (`scroll-snap`), sin JavaScript. |
| **`scrollbar-gutter: stable` en `html`** | Al pasar de una pantalla larga (con barra de scroll) a una corta, el ancho disponible cambiaba y toda la barra de navegación se corría ~7 px. | `nav.spec.ts` lo mide con barras reales. |
| **Las grillas con filas deslizables adentro usan `grid-cols-[minmax(0,1fr)]`** | Una celda de grilla no puede ser más angosta que su contenido: la fila de tarjetas estiraba el viewport del celular a 870 px. | Regla en las guías del equipo; lo cubre la prueba de «sin scroll horizontal» de las pantallas nuevas. |

## El menú de la cuenta no mueve la página (2026-11-06)

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **`html body[data-scroll-locked] { margin-right: 0 !important }`** en `globals.css` | Radix bloquea el scroll mientras hay un menú o diálogo abierto (`overflow: hidden` en el body) y, para compensar la barra de scroll que desaparece, le suma `margin-right` igual al ancho de la barra. Como `html` ya reserva ese lugar con `scrollbar-gutter: stable`, la compensación se duplicaba y toda la página se corría ~7 px al abrir y al cerrar. | Vale para todo lo que bloquee el scroll (menús, diálogos), no solo el menú de la cuenta. Se gana a la regla de Radix por especificidad (las dos son `!important` y sin capa). `user-menu.spec.ts` mide la barra, el contenido y el scroll antes, con el menú abierto y después, en tres pantallas. Si algún día se saca `scrollbar-gutter`, hay que sacar esta regla. |

## El menú de la cuenta conserva la barra de scroll (2026-11-06)

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Los menús desplegables son no modales por defecto** (`modal={false}` en `components/ui/dropdown-menu.tsx`) | Un menú modal bloquea el scroll de la página y el navegador hace desaparecer su barra mientras está abierto (el ancho de la página igual se conservaba gracias a la regla anterior, pero la barra se iba). | La página no se bloquea ni se mueve y la barra queda donde estaba. El menú se sigue cerrando con Escape, al tocar afuera y al salir el foco. Con el menú abierto se puede scrollear la página. `user-menu.spec.ts` mide el ancho de la barra y que no haya bloqueo (falla con un menú modal). |
| **La regla `html body[data-scroll-locked]` se queda** | Los diálogos (como el editor de la foto) sí son modales y bloquean el scroll. | Ahí la barra sigue desapareciendo mientras el diálogo está abierto, pero la página ya no se corre. |

## «Cambios guardados» solo al guardar (2026-11-06)

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **`useSuccessToast(state)`** (`lib/use-success-toast.ts`) en vez de un `useEffect` suelto en cada formulario | Next conserva el estado de las pantallas ya visitadas y, al volver con atrás/adelante, reejecuta sus efectos: el resultado «guardado» de una sesión anterior volvía a disparar el aviso (dos veces en desarrollo) aunque la persona solo estuviera entrando a *Editar perfil*. | El hook recuerda qué resultado ya anunció y no repite. Lo usan *Editar perfil* y *Preferencias*; todo formulario nuevo con aviso de éxito debe usarlo. `settings-toast.spec.ts` guarda, va atrás y adelante, y lee el conteo de avisos **sin reintentos** (un reintento dejaría pasar un aviso repetido que dura unos segundos). |

## Buscador de juegos (2026-11-06)

Migración nueva: `20261106000100_search_games.sql`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Buscador en la portada, debajo del título y sobre los botones** (no en la barra de arriba) | Pedido del producto: que sea lo primero que se ve, sin recargar el menú, que quedó con dos opciones. Entra en la primera pantalla en escritorio y en celular de 360 px. | `GameSearch` (`components/search/`) con dos variantes (`hero` y `page`); en celular el botón es solo la lupa. |
| **La búsqueda vive en la base: `search_games(texto, límite)`** y devuelve ids con su relevancia | Ya existía `games.search_doc` (título > descripción y etiquetas > género, motor y creador, sin tildes). Un solo lugar define qué coincide y en qué orden; la app solo trae los juegos por id. | Cada palabra se busca como **prefijo** (sirve para las sugerencias). Del texto solo se conservan letras y números, así que nada de lo que se escriba llega como operador de `tsquery`; hasta 8 palabras y 80 caracteres. `SECURITY INVOKER` + filtro `published`: ni los borradores propios aparecen. |
| **Sugerencias por Server Action**, no por una API propia | Mismo patrón que el resto de la app: el texto del navegador se sanea y valida con Zod (`lib/validation/search.ts`) antes de tocar la base. | Pausa de 200 ms al escribir, mínimo 2 caracteres y se descartan respuestas viejas. Sin tope de uso por ahora (llega con la Fase 5). |
| **Patrón combobox accesible** (flechas, Enter, Escape, `aria-activedescendant`, aviso «N sugerencias») | Es un campo que se usa en cada visita: tiene que andar igual con teclado y lector de pantalla. | `search.spec.ts` lo recorre en escritorio y celular; `quality.spec.ts` audita con axe las pantallas de resultados. |
| **`/explore` pasa a ser la pantalla de resultados** (antes «en construcción») | Sin destino, el buscador no sirve. | Muestra los resultados o, sin texto, los juegos más nuevos (48 como máximo). Los filtros por género y motor, el orden y «Sorprendeme» siguen siendo de la Fase 4. |
| **Sin JavaScript el formulario igual envía a `/explore?q=…`** | Es un `<form method="get">` real. | Los resultados llegan por *streaming*, igual que el resto del sitio, y sin JavaScript ese contenido no se muestra: es una limitación general de la app, no del buscador. |

## Validador de zips de juegos (2026-11-05)

Primera pieza de la subida de juegos: el validador y las reglas, sin infraestructura. Sin migración nueva (`game_versions` ya tiene `error_code`, `error_params` y `scan_flags`).

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Reglas en un JSON único** (`packages/shared/upload-rules.json`) que leen el validador y los tests de la web | Los límites, las extensiones y los códigos de error no pueden divergir entre el navegador (aviso previo) y el worker (decisión real). | El worker lo carga al arrancar; un test de la web exige un mensaje en es y en en por cada código, y uno de Python que el enum de errores coincida con el JSON. |
| **Solo biblioteca estándar de Python**, sin dependencias de ejecución | Cada dependencia es superficie de ataque en el componente que abre archivos de desconocidos. `zipfile` basta. | Imagen mínima; ruff, mypy estricto y pytest viven solo en la imagen de pruebas. |
| **Tres pasadas, en este orden:** directorio central → plan → descompresión | Lo barato y sin riesgo va primero: nada se descomprime hasta que el plan pasó todas las reglas. | `locate_central_directory` cuenta las entradas leyendo solo los encabezados **antes** de que `zipfile` cree un objeto por entrada (millones de entradas diminutas agotarían la memoria); `plan_archive` aplica rutas, tipos y extensiones; `stream_verified` descomprime contando los bytes **reales**. |
| **El tamaño declarado en el zip no es de fiar** | Un zip puede mentir sobre cuánto pesa al descomprimirse. | Se topea con los bytes que realmente salen, por archivo y en total; si el tamaño real no coincide con el declarado, o falla el CRC, es `CORRUPT_ARCHIVE`. |
| **Se rechazan las entradas que se pisan** (`OVERLAPPING_ENTRIES`) | Es la forma de armar un zip-bomb sin ocupar disco: muchas entradas apuntando a los mismos bytes comprimidos. | Se compara con cotas inferiores del encabezado local, así no se rechaza ningún zip legítimo. |
| **Seguridad de la ruta antes que ignorar la basura** | `__MACOSX/../../x` no debe pasar solo por estar en una carpeta que se descarta. | Cualquier ruta insegura rechaza el zip, aunque sea de las que se ignoran (`__MACOSX/`, `.DS_Store`, `Thumbs.db`, `._*`). Rutas que difieren solo en mayúsculas o forma Unicode son `DUPLICATE_PATH`. |
| **Ejecutables y comprimidos anidados se detectan por extensión y por los primeros bytes** | Renombrar un `.exe` a `.png` no debe servir. | ELF, Mach-O, PE (MZ solo si el offset del encabezado PE cae dentro del archivo, para no confundir un texto que empieza con «MZ»), ZIP, RAR y 7z. Un `.zip` dentro del zip se rechaza aunque su nombre sea `niveles.dat`. |
| **Solo extensiones de la lista; sin extensión no vale** (`LICENSE`, `.htaccess`) | La lista se mantiene corta y revisable; lo desconocido se rechaza. | `.br`/`.gz` valen solo como segunda extensión (`juego.wasm.br`). Si un motor real necesita otra, se agrega al JSON con su caso de prueba. |
| **Cifrado, symlinks, archivos especiales y métodos distintos de Stored/Deflate se rechazan** | Cada uno es una forma de saltar el escaneo o de escapar de la carpeta. | `bzip2` y `lzma` se descartan por costo y por ser raros en zips de juegos. |
| **Escaneo sospechoso que marca pero no bloquea** (`scan_flags`) | Los falsos positivos serían frecuentes (`top.location` aparece en código legítimo). | `CRYPTO_MINER`, `PASSWORD_FIELD` y `TOP_NAVIGATION_ATTEMPT` en html/js; revisa hasta 16 MiB por archivo y encuentra textos partidos entre trozos. Los archivos `.br`/`.gz` no se escanean. |
| **El validador recibe un destino** (`Sink`) en vez de escribir él mismo | Validar y extraer en una sola pasada, sin leer 1 GB dos veces. | **Nada se publica hasta que `validate_archive` termina sin error**: el worker escribe en una carpeta temporal y sube recién después. Los mensajes de error nunca llevan caracteres de control ni de dirección. |

## Subida de juegos (2026-11-06)

Migración nueva: `20261106000200_game_upload.sql`. Buckets nuevos: `quarantine` y `games` (privados, sin lista de tipos).

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **El `.zip` va del navegador al bucket de cuarentena con una URL firmada**, nunca por el servidor de la app | Hasta 200 MB: pasarlos por una función serverless sería caro, lento y sujeto a sus límites de cuerpo. | `createQuarantineUploadUrl` firma un PUT que **fija el tipo (`application/zip`) y el tamaño exacto** y vence en 1 hora; un tipo o tamaño distinto da `SignatureDoesNotMatch` (probado). Se firma con `S3_PUBLIC_ENDPOINT`, la dirección que ve el navegador: la firma incluye el host. |
| **Crear la versión es una función SQL** (`create_game_version`), no un INSERT | El dueño no puede insertar versiones ni cambiar su estado (RLS sin policy). La función revisa dueño, cuenta activa, tamaño declarado (≤ 200 MiB) y el cupo de 5 subidas por 24 h entre **todos** sus juegos, y arma la clave `{game_id}/{version_id}.zip`. | `confirm_version_upload` pasa `uploading` → `processing` (eso la pone en la cola del worker) y solo la puede llamar el dueño. Las constantes del SQL las vigila un test contra `upload-rules.json` y `lib/games/upload-rules.ts`. |
| **El juego nace borrador y solo se publica cuando el worker marque la versión como lista** | Nadie debe publicar algo que no pasó la revisión. | Los borradores los ve solo su dueño (RLS). Mientras no exista el worker, una subida terminada queda «Revisando». |
| **Las imágenes sí pasan por el servidor**, con la misma desconfianza que la foto de perfil | Son chicas (≤ 5 MB) y conviene mirar sus bytes antes de guardarlas. | `inspectImage` comprueba formato real, que el tipo declarado coincida, que no sea animada y la medida (320×180 a 4096×4096). La base valida las rutas con un CHECK (`covers/<dueño>/…`, `screenshots/<juego>/…`). |
| **Si algo falla después de crear el juego, se deshace todo** (juego, imágenes ya subidas) | Que un error no deje borradores a medias ni archivos sin dueño. | Si, en cambio, se corta **solo la subida del zip**, el juego queda creado y el formulario ofrece reintentar con el mismo archivo (pide una URL nueva). |
| **Orquestación en el cliente** (envío → subida con XHR y barra de progreso → confirmación) | `fetch` no informa el progreso de una subida. | El formulario no es una Server Action de formulario: `createGameAction`, `confirmUploadAction` y `renewUploadUrlAction` son acciones llamadas a mano. |
| **La pantalla de estado se actualiza con `router.refresh()` cada 3 s** mientras haya versiones en curso | Simple y robusto; Realtime queda para cuando haya más de un estado que seguir. | `/games/<id>/manage` solo existe para el dueño (404 para el resto). |
| **`e2e/run.sh` borra los archivos que subieron los tests** | Los archivos no se borran con la cuenta. | Usa `supabase --experimental --yes storage rm` sobre las claves exactas (nunca sobre un bucket entero: borraría el bucket). |

## Worker de juegos y publicación (2026-11-06)

Migración nueva: `20261106000300_game_worker.sql`. Servicio nuevo en `docker-compose.yml`: `worker`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **El worker habla con Postgres con un rol mínimo, `game_worker`**, y solo por cuatro funciones del esquema `worker` | Es el único componente que abre archivos de desconocidos; si lo comprometen, no debe poder leer ni tocar nada más. | El rol se crea **sin login** y sin ningún permiso sobre tablas; `worker.claim_version`, `complete_version`, `fail_version` y `release_version` son `SECURITY DEFINER` y solo ese rol puede ejecutarlas. El esquema no está expuesto por la API. `./start.sh` le pone una contraseña propia de cada máquina. |
| **Cola en la misma tabla, con `FOR UPDATE SKIP LOCKED`** | Sin un servicio extra; dos workers nunca toman la misma versión. | Un bloqueo de más de 10 minutos se considera abandonado y la versión se toma de nuevo; tras 3 intentos falla con `PROCESSING_FAILED` en vez de repetirse sin fin. |
| **Rechazo ≠ falla de infraestructura** | Si un zip rompe una regla, es definitivo y se explica; si cayó el almacenamiento, la persona no tiene la culpa. | `UploadRejected` → `fail_version` con el código estable. Cualquier otra excepción → `release_version` y se reintenta; lo publicado a medias se borra. |
| **Se verifica el tamaño real del objeto antes de descargarlo** | El tamaño declarado lo manda el navegador. | Más grande que el tope → `ZIP_TOO_LARGE`; distinto de lo declarado → `CORRUPT_ARCHIVE`; ni se descarga. |
| **Nada llega al bucket de juegos hasta que todo pasó** | «Un zip rechazado nunca toca el bucket público». | Se valida mientras se extrae a una carpeta temporal (`DirectorySink`); recién entonces se suben los archivos, en paralelo, a `<public_id>/v<n>/…` con su `Content-Type` y `Content-Encoding`, y se borra el zip de cuarentena. Un reintento limpia primero lo que dejó un intento anterior. |
| **El motor se detecta por nombres y contenido, y es una etiqueta, no una decisión de seguridad** | Para mostrar «hecho con Godot» y saber si un Godot con hilos pide COOP/COEP. | Si no hay señal clara queda `other`. Un Godot con `GODOT_THREADS_ENABLED = true` o con `*.worker.js` marca `needs_isolation`. |
| **El contenedor corre endurecido** | Mismo motivo que el rol mínimo. | Usuario sin privilegios, sistema de archivos de solo lectura, sin capacidades, `no-new-privileges`, 1 GB de memoria y 128 procesos; solo escribe en un volumen de trabajo y `/tmp`. Reinicio automático y *healthcheck* por latido. |
| **El dueño decide cuándo publicar** (botón en `/games/<id>/manage`) | Que la versión esté lista no significa que quiera mostrarlo. | La base rechaza publicar un juego sin versión lista (`publish_requires_ready_version`); el primer `ready` queda como versión activa, las siguientes no la cambian solas. |
| **`StatusBadge` en vez de `Badge` para estados** | Las etiquetas pixel de 11 px sobre fondos translúcidos casi no se leían. | Texto blanco de 14 px sobre el color teñido, con un punto de color (que late mientras algo está en curso). El test de contraste valida los cuatro estados (≥ 4,5:1). |

## Servidor de juegos y reproductor (2026-11-06)

Migración nueva: `20261106000400_game_play.sql`. Servicio nuevo en `docker-compose.yml`: `gateway`. Paquete nuevo: `apps/gateway`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Cada juego se sirve desde `<public_id>.<dominio de juegos>`, otro sitio que Trafal** | El marco lleva `allow-same-origin` (los motores guardan partidas en IndexedDB/localStorage); solo es seguro si el origen del juego nunca es el del sitio. | En local, `games.localhost:4000` (otro sitio que `localhost:3000`, sin que haya que tocar nada en la máquina). En producción, un dominio registrable aparte, y **cambiarlo resetea las partidas guardadas**. |
| **El handler del gateway es una función `Request → Response`** (`apps/gateway/src/handler.ts`), sin depender de Node | Es el mismo código para el contenedor local y para un Cloudflare Worker. | Lo único propio de cada entorno son el almacenamiento (`GameStorage`: hoy la API S3; en Workers, el binding de R2) y el adaptador HTTP. Falta el adaptador de R2. |
| **Las páginas HTML solo se entregan con `Sec-Fetch-Dest: iframe` (o `empty`)** | Anti-phishing: una URL de juego abierta en una pestaña podría mostrar un falso login sin la barra de Trafal. | Cualquier otro destino (`document`, sin cabecera, etc.) recibe un 302 a `/games/<id>` en Trafal. Los recursos (scripts, imágenes, audio) se piden directos sin problema. |
| **CSP: el juego solo habla con su origen** (`connect-src 'self'`), sin formularios, plugins ni marcos, y solo Trafal puede mostrarlo | Un juego es código ajeno: que no pueda mandar datos afuera ni navegar a otro lado. | Se permiten `unsafe-inline`, `unsafe-eval` y `wasm-unsafe-eval` porque los motores los necesitan, y una lista corta de CDN públicos para scripts, estilos y fuentes (`GATEWAY_CDN_*`). Más `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` cerrada y sin CORS ni cookies. |
| **El marco usa `sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-modals"`** y `allow="fullscreen; autoplay; gamepad…"` | Sin `allow-top-navigation`, `allow-popups`, `allow-forms` ni `allow-downloads`: el juego no puede sacar a la persona de Trafal. | `game-player.spec.ts` verifica los atributos exactos. |
| **`game_delivery` es `SECURITY DEFINER`** y devuelve `published` o `gone` | El gateway usa la clave pública y los juegos moderados son invisibles para ella; así puede responder 410 sin ver nada más. | Borradores y ids inexistentes no devuelven nada (404): no se puede distinguir un borrador de un juego que no existe. |
| **El estado de entrega se recuerda 10 s** (5 s si no existe) | Una carga de juego son decenas de pedidos; sin esto serían decenas de consultas. | Es también el retraso con que deja de servirse un juego que se oculta o se vuelve borrador. |
| **Los archivos se entregan con `Cache-Control: no-cache` y un ETag que incluye la versión** | La URL `/game.js` es la misma entre versiones, así que no puede ser `immutable`. | Los navegadores revalidan (304) y al cambiar la versión activa reciben el archivo nuevo. Hay soporte de rangos para audio y video. |
| **Las partidas se cuentan con `start_play` (una por sesión de página) y se mide el tiempo activo con `play_heartbeat`** | Estadísticas sin datos personales: solo se guarda la clase de dispositivo y, si hay sesión, el perfil. | El latido suma como mucho 35 s y no más de uno cada 10 s. Las llamadas son *perezosas*: un `supabase.rpc(...)` no envía nada hasta que se espera su resultado (`fireAndForget`). |
| **«Reportar» usa la tabla `reports` con la sesión de la persona** | Ya tenía RLS, un tope de un reporte abierto por persona y juego, y copia del contenido. | Requiere cuenta. El enrutado («no funciona» al creador, el resto a la cola de admin) y el panel son de la Fase 5. |

## Versiones de un juego (2026-11-06)

Migración nueva: `20261106000500_game_versions.sql`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Una versión nueva nunca pasa a ser la que se juega sola** | Que una versión esté lista no significa que el creador quiera mostrarla; además puede querer volver atrás si falla. | El worker solo activa la primera versión lista de un juego; después manda el creador con `set_active_version(version)` (función `SECURITY DEFINER`: solo versiones **listas** de juegos **propios**; `games.active_version_id` sigue sin permiso de escritura directa). Se puede elegir una más nueva o volver a una anterior. |
| **Subir una versión usa la misma tubería que la primera** | Una sola forma de entrar al worker, una sola superficie que defender. | `create_game_version` (con su cupo de 5 por día entre todos los juegos) → URL firmada → `confirm_version_upload` → worker. El hook `useZipUpload` comparte la subida con progreso y reintento entre «subir un juego» y «subir una versión». |
| **El nombre y el registro de cambios se editan en cualquier momento y en cualquier estado** | Corregir un error de tipeo o completar el registro no cambia lo que corre. | Es el `UPDATE` de dos columnas que la base ya permitía al dueño (RLS + permiso por columna); nombre de 1 a 24 caracteres, cambios hasta 2000. No hay nombres únicos por juego. |
| **La página pública lista solo las versiones listas** | Las que están subiendo, en revisión o con errores son asunto del creador. | La política de lectura de la tabla ya lo garantizaba; la sección marca la versión actual y muestra cuándo estuvo lista y qué cambió. |
| **El servidor de juegos sirve la versión activa**: al cambiarla, el cambio llega en pocos segundos | Ya consultaba `game_delivery` con un recuerdo de 10 s. | `game-versions.spec.ts` lo comprueba pidiendo el script del juego al servidor antes y después de cambiar. |

## Juego malicioso de prueba (2026-11-07)

Sin migración. Cambio en el servidor de juegos (`apps/gateway/src/handler.ts`) y prueba nueva `e2e/tests/game-malicious.spec.ts`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Se prueba la defensa con un juego hostil de verdad**, subido y publicado por el camino normal | El criterio de la Fase 2 es que un juego no pueda tocar nada del sitio; solo se sabe atacando. El escáner del worker es una heurística (rechaza `top.location` escrito literal) y el juego de la prueba lo esquiva a propósito: la barrera real es el marco, la CSP y el servidor de juegos. | El juego corre ~30 ataques con una persona **con sesión** jugándolo: leer cookies y almacenamiento del sitio, `top`/`parent`, `document.domain`, navegar la ventana de arriba, popups, formularios, enlaces `_top`, descargas, `fetch`/XHR/beacon/imagen/WebSocket/marco hacia el sitio, la API y otro juego, service worker, cámara, ubicación y portapapeles. La prueba exige que ninguno funcione, que ningún pedido con la marca llegue a respuesta (todos mueren por CSP), que no haya popups ni descargas, que la página no cambie de URL y que el navegador no mande ninguna cookie al dominio de juegos. |
| **El servidor de juegos no entrega scripts de service worker** (`Sec-Fetch-Dest: serviceworker` → 403) | La prueba encontró que un juego **sí podía registrar un service worker** en su propio dominio (`worker-src 'self'` lo permite, y los workers comunes hacen falta). Un service worker sobrevive a que el juego se oculte o se reemplace y sigue respondiendo por su origen. | Los workers normales (`worker`, `sharedworker`, `blob:`) siguen andando; solo se corta el de tipo service worker. Un juego no se instala nunca como app que el creador pueda dejar corriendo tras bajarlo. |

## Me gusta y guardados (2026-11-07)

Sin migración: las cuatro tablas (`game_likes`, `post_likes`, `game_saves`, `post_saves`), sus políticas, permisos por columna y triggers de contadores ya existían desde la Fase 1; esta pieza los usa y agrega `12-reactions.test.sql`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Una sola Server Action idempotente** (`setReactionAction`) que pide un **estado** (`active: true/false`), no un «alternar» | Un doble clic, un reintento o dos pestañas no pueden dar un resultado distinto según el orden. | Poner dos veces el mismo me gusta no falla (23505 se toma como «ya está»); quitar uno que no existe no hace nada. El argumento pasa por Zod (`lib/validation/reaction.ts`). |
| **La base decide quién puede qué; la acción solo traduce errores** | Seguridad en la base, no en la interfaz. | RLS: solo tus propias marcas, solo sobre contenido que ves (un borrador o un juego oculto ajeno da 42501), solo cuentas activas; permiso de `INSERT` por columna (no se elige la fecha) y sin `UPDATE`. Los contadores los mantiene un trigger: la acción devuelve el número real leído después. |
| **Botones optimistas que se corrigen** | Un me gusta tiene que sentirse inmediato. | Se marca al tocar, se bloquea mientras viaja y, si el servidor falla, vuelve atrás con un aviso. Sin cuenta, son enlaces al login con `?next=` a la misma página. |
| **Los me gusta y los guardados son privados**; el público ve solo contadores | Quién guardó qué no es asunto de nadie más. | «Guardados» (`/saved`) lista lo guardado por la persona; los guardados no muestran contador en la interfaz (sí existe `save_count`). Los botones de avances aparecen en la página del juego, el perfil y «Guardados»; la portada (cacheada, sin datos de la persona) sigue mostrando solo el contador. |

## Publicar avances (2026-11-07)

Migraciones nuevas: `20261107000100_post_media_rules.sql` y `20261107000200_edit_posts.sql`. Las tablas `posts` y `post_media` y su RLS ya existían desde la Fase 1.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Los archivos pasan por el servidor** (Route Handler `POST /api/posts`, multipart) y no por una URL firmada | Son imágenes, GIF y MP4 chicos (≤ 20 MB), y el servidor puede **inspeccionar los bytes** antes de guardarlos, algo que una URL firmada no permite. Los zips de juegos son otra cosa: pesan hasta 200 MB y los revisa el worker. | Un Server Action no sirve: el tope de cuerpo de Next (1 MB por defecto) es global; subirlo para todas las acciones agrandaría la superficie de ataque. El handler rechaza antes de leer el cuerpo si falta `Content-Length` (411) o excede 4 × 20 MB (413). |
| **El handler hace él mismo la comprobación de origen** (`Origin` debe ser el del sitio) | Las Server Actions traen esa defensa contra CSRF; un Route Handler no. | Sin `Origin` o con otro → 403 antes de tocar nada. Además las cookies de sesión son `SameSite=Lax`. |
| **Inspección propia de GIF y MP4** (`lib/media/post-media.ts`), además de la de PNG/JPEG/WebP | Ni el nombre ni el tipo MIME de un archivo son de fiar. | GIF: bloque por bloque hasta el terminador, que tiene que ser el último byte (nada pegado), ≤ 1920 px y ≤ 600 cuadros. MP4: cajas que suman el largo exacto del archivo, `ftyp` de una marca conocida, `moov` y `mdat`, y el tamaño de la pista de video. Sin transcodificación ni miniaturas en el MVP: se sirve lo que subió la persona, ya revisado. |
| **Se quitan los datos de la foto** (EXIF/XMP de JPEG, textos y EXIF de PNG) sin recodificar | Una foto del celular trae la ubicación GPS: publicarla sería regalarla. Los avatares ya los recodifica el navegador, estas imágenes no. | Se recortan los segmentos del archivo y se vuelve a inspeccionar; si el resultado no es la misma imagen, se usa el original. **No** se limpian WebP, GIF ni MP4 (ver limitaciones). |
| **La base valida cada archivo**: ruta `posts/<id del avance>/<32 hex>.<ext>`, tipo ↔ clase ↔ extensión y tope por clase (imagen 5 MiB, GIF 8 MiB, video 20 MiB) | Nadie debe poder apuntar un archivo a la carpeta de otro avance, a otra carpeta del bucket ni a una URL externa. | Los CHECK `post_media_path_fmt`, `post_media_kind_matches_mime`, `post_media_ext_matches_mime` y `post_media_bytes_by_kind`; `13-post-media.test.sql` los prueba. |
| **Si algo falla, no queda nada**: el avance y los archivos ya subidos se deshacen | Un avance a medias (sin su video) no es lo que la persona quiso publicar. | El orden es: validar todo → crear el avance → subir cada archivo y registrarlo; ante un error se borran el avance y los objetos guardados. |
| **Un avance solo se liga a un juego propio y publicado** | Un enlace a un borrador daría 404. | La acción lo comprueba (RLS filtra los ajenos) y el trigger `posts_before_write` exige que el juego sea del autor (`game_not_owned`). Un avance cuyo juego se despublicó se puede seguir editando sin cambiarlo. |
| **Se puede editar todo, en una sola transacción** (`edit_post`, migración `20261107000200`) | La persona pidió poder cambiar tipo, juego, texto y archivos, no solo el texto. Reordenar archivos choca con `unique (post_id, position)`, y un fallo a medias dejaría un avance sin la mitad de sus archivos. | La función reemplaza los campos y la lista de archivos de una vez. Es **`SECURITY INVOKER`** a propósito: cada sentencia corre como quien llama, así que RLS y los permisos por columna siguen decidiendo (solo el autor, solo un avance publicado, solo una cuenta activa) y los CHECK de la tabla siguen validando cada archivo. Se agregó el permiso `UPDATE (kind, game_id)`; autor, estado y contadores siguen fuera de alcance. |
| **La edición manda la lista final de archivos** (`PUT /api/posts/<id>`, multipart) | El servidor no se fía de lo que dice el navegador sobre archivos ya guardados. | Los archivos que se quedan viajan por id y el servidor arma sus datos desde la base (solo toma la descripción del navegador); los nuevos se inspeccionan igual que al publicar. Primero se suben los nuevos, después la base cambia todo, y recién entonces se borran los que ya no están; si la base falla, se borran los recién subidos. |
| **Borrar es borrar** (no «ocultar») | La persona pidió borrarlo. Los reportes ya guardan una copia del contenido como evidencia. | Se leen las rutas de los archivos, se borra la fila (caen en cascada me gusta, guardados, comentarios y archivos de la base) y recién después se borran los objetos del almacenamiento. |

## Comentarios (2026-11-07)

Migración nueva: `20261107000300_comment_rules.sql`. La tabla `comments`, su RLS, sus triggers y los contadores ya existían desde la Fase 1.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Un comentario solo se edita mientras está publicado** | La política de `UPDATE` nunca miraba el estado: quien había sido moderado podía reescribir lo que dijo. | La política exige `status = 'published'` en `USING` y `WITH CHECK`. Borrar lo propio sigue permitido (los reportes guardan una copia del contenido como evidencia). |
| **Una respuesta solo contesta un comentario publicado** | Responder a uno oculto reviviría la conversación. | El trigger `comments_before_write` devuelve `parent_not_found` si el comentario padre no existe o no está publicado. Se mantienen: un solo nivel, mismo juego o avance, sin etiqueta ni pregunta en una respuesta. |
| **Cada avance tiene su propia página** (`/posts/<id>`) | Los comentarios de un avance necesitan un lugar, y un enlace compartible (el feed y «compartir» lo van a usar). | El contador de comentarios de cada tarjeta de avance es un enlace a esa página (`#comments`). Los comentarios de un juego siguen en la página del juego. |
| **Tres Server Actions con el mismo patrón que el resto** (`addCommentAction`, `updateCommentAction`, `deleteCommentAction`) | Argumentos por Zod, y la base decide quién puede qué. | La acción comprueba que el destino sea visible para la persona (si no, `notFound`) y traduce los errores de la base (`reply_depth_exceeded`, `parent_not_found`…) a mensajes en es/en. |
| **Botones de editar y borrar solo para el autor, pero es cortesía** | La seguridad no está en la interfaz. | Se muestran con `viewer.userId === comment.author_id`; `14-comments.test.sql` prueba que nadie más puede. Borrar un comentario con respuestas se las lleva (`ON DELETE CASCADE`), y el diálogo lo avisa. |

## Preguntas del creador y «Me sirvió» (2026-11-07)

Migración nueva: `20261107000400_comment_helpful.sql`. Las preguntas (`game_questions`), las respuestas (`comments.question_id`, una por persona y pregunta) y la columna `is_helpful` ya existían desde la Fase 1.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Marcar «Me sirvió» es una función** (`set_comment_helpful`, `SECURITY DEFINER`) y no un permiso de columna | Solo el dueño del juego o el autor del avance puede marcar, y nunca su propio comentario: una política de columna no puede expresar eso. | La función exige sesión y cuenta activa, un comentario **publicado** y de **primer nivel** de otra persona, sobre un juego o avance **publicado** del que quien llama es dueño. `is_helpful` sigue sin permiso de `UPDATE` directo. Errores: `not_owner` (42501), `own_comment`, `reply_cannot_be_helpful`, `comment_not_found`. |
| **Marcar no es editar**: `updated_at` solo se mueve si cambian el texto o la etiqueta | Si marcar tocara la fecha, el aviso «(editado)» aparecería en cualquier comentario que el creador encontró útil. | El trigger `comments_touch_updated_at` pasó a `BEFORE UPDATE OF body, label`. `15-comment-helpful.test.sql` lo comprueba fijando la fecha en 2020 y marcando. |
| **Las respuestas a una pregunta son comentarios del juego con `question_id`**, no una tabla aparte | Heredan todo lo ya resuelto: editar, borrar, responder, moderar y el contador. | En la página se separan de los comentarios generales (`question_id` nulo) y se muestran bajo su pregunta. Una persona responde una vez por pregunta (índice único, que la interfaz traduce a «Ya respondiste»); si borra su respuesta puede responder de nuevo. |
| **El creador no responde sus propias preguntas** | Las preguntas son para escuchar a la gente. | La interfaz le muestra «Estas son tus preguntas» y no el formulario; la base no lo impide (podría comentar el juego normalmente). |
| **Las preguntas no se editan después de crear el juego** (todavía) | Fuera de este alcance: la base ya permite al dueño cambiarlas, falta la pantalla. | Anotado en limitaciones. |

## Feed y compartir (2026-11-08)

Sin migración: se usan `posts`, `follows` y sus políticas de lectura.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **La vista del feed vive en la dirección** (`/feed?kind=…&scope=…&before=…`) y los filtros son enlaces | Se puede compartir, funciona el botón de atrás y no hace falta JavaScript. | Los valores raros (tipo o fecha inventados, inyecciones) caen al valor por defecto por Zod (`parseFeedQuery`); `feedHref` deja afuera lo que es por defecto para que los enlaces sean cortos. |
| **Paginación por fecha** (`before` = fecha de la última publicación vista), no por número de página | Si alguien publica mientras se lee, un número de página repetiría o saltearía publicaciones. | Se piden 13 y se muestran 12: si hay una más, hay otra página. Dos publicaciones con la misma fecha exacta podrían quedar en el borde (improbable; el feed no es un registro). |
| **«A quienes seguís» solo con cuenta, y en la base** | Un feed sin seguir a nadie sirve poco, y el grafo de seguidos ya existe. | Se leen los seguidos de la persona (`follows`, solo los suyos) y se filtra por autor; sin seguidos, vacío con una explicación. Para quien no tiene cuenta el parámetro `scope` se ignora. |
| **Compartir copia o abre el menú del dispositivo; no cuenta compartidos** | Contar exigiría una función que cualquiera (incluso sin cuenta) pudiera llamar: se inflaría con facilidad. | `share_count` queda sin escribir hasta que existan los límites de uso (Fase 5). El enlace usa `NEXT_PUBLIC_SITE_URL` y el idioma de la persona; cancelar el menú nativo no es un error. |
| **La portada sigue sin botones en los avances** | Está cacheada y no conoce a quien la mira. | Lleva al feed con «Ver todos los avances», donde sí están. |

## Explorar con filtros y orden (2026-11-08)

Migración nueva: `20261108000100_explore_games.sql`. Se usa el índice de búsqueda de `games` (`search_doc`) que ya existía.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Una sola función hace todo** (`explore_games(texto, género, motor, solo_celular, orden, límite, desde)`) y devuelve ids con el total | Filtrar, ordenar y contar en la base evita traer todos los juegos para recortarlos en la app, y el total permite paginar. | La app carga los juegos por id respetando ese orden (como en las sugerencias). Los topes (48 por página, 10 000 de desplazamiento) y los valores por defecto los pone la función, no solo la interfaz. |
| **`SECURITY DEFINER`, con `published` filtrado a mano** | «En tendencia» cuenta filas de `plays`, que solo leen los admins. | La función solo devuelve ids de juegos publicados y conteos: nunca quién jugó, cuándo ni desde qué. `16-explore.test.sql` comprueba que ni los borradores propios aparecen y que `plays` sigue ilegible. |
| **«Tendencia» = partidas de los últimos 7 días**; a igual cantidad, más me gusta y luego más nuevo | Es fácil de explicar y de probar; un puntaje que mezcle me gusta, comentarios y guardados sería opaco. | Un juego sin partidas recientes queda detrás de uno con alguna. Cuenta inicios de partida, que ya no guardan IP. |
| **«Más relevantes» solo existe con un texto**; sin texto es lo mismo que «más nuevos» | Sin búsqueda no hay nada que ordenar por parecido. | El orden por defecto es «más relevantes» cuando hay texto y «más nuevos» cuando no; `defaultSort` lo decide en un solo lugar (la base y la interfaz coinciden). |
| **Todo en la dirección y validado** (`parseExploreQuery`/`exploreHref`) | Compartir, atrás, y que nada de lo que venga de afuera llegue a la consulta. | Géneros y motores se comparan con el catálogo, el orden con la lista, la página es un entero entre 1 y 400; lo demás vuelve al valor por defecto. El texto llega a la base ya limpio y, como en `search_games`, solo conserva letras y números (nunca un operador de búsqueda). |
| **El formulario arma la dirección corta con un envoltorio de cliente** (`ExploreForm`) | Un formulario GET manda todos los campos, incluso vacíos o por defecto (`?genre=arcade&engine=&sort=recent`). | Al enviarse pasa por el mismo analizador y navega a la dirección limpia. La pantalla no se promete sin JavaScript: su contenido llega por streaming (`Suspense`), que lo necesita. |
| **Paginación por número de página** (`?page=N`) | Al explorar no importa que un juego nuevo corra una página; no es un registro. | Pasarse de la última página muestra «Esa página no existe» con un enlace a la primera. |

## Sorprendeme (2026-11-09)

Migración nueva: `20261108000200_random_game.sql`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **El azar es parejo entre todos los juegos publicados** | Si pesara por partidas, «Sorprendeme» mostraría siempre lo ya popular; la idea es darles su turno a los creadores nuevos. | `random_game(excluir)` ordena por `random()`. Con miles de juegos habría que cambiar el método (hoy es lineal en la cantidad de juegos); `17-random-game.test.sql` comprueba que el más jugado no tiene más chance (cerca de un tercio). |
| **Función `SECURITY INVOKER`, con `published` filtrado a mano** | No necesita permisos de más: la RLS de `games` ya manda, y esa política también deja ver los borradores propios. | Ni siquiera el creador recibe su borrador. Si el juego a excluir es el único publicado, vuelve ese mismo (no hay otra cosa para mostrar); sin juegos publicados, no devuelve nada y se va a Explorar. |
| **Una ruta que redirige** (`GET /api/surprise?lang=…&exclude=…`) y el botón es un enlace común (`<a>`, no el `Link` del router) | Sin JavaScript también funciona, y el router no debe precargarlo: cada visita tiene que elegir de nuevo. | La redirección es 307 y `Cache-Control: no-store`. El idioma y el juego a excluir pasan por Zod (`parseSurpriseParams`); lo que no cuadra se ignora. Solo responde a GET. |

## Creadores (2026-11-09)

Migración nueva: `20261108000300_explore_creators.sql`. No hace falta tabla nueva: se usan `profiles` (públicos), `games` y `follows`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Solo aparece quien tiene al menos un juego publicado** | «Creadores» es un directorio de quienes hacen juegos; alguien que solo juega no es creador todavía, y una cuenta sin nada que mostrar no ayuda a descubrir. | Si moderación oculta el único juego de alguien, deja de figurar (`18-explore-creators.test.sql`). Quien nunca publicó se encuentra por su perfil, no por el directorio. |
| **Una función hace todo** (`explore_creators`, `SECURITY INVOKER`) y devuelve ids con el total | Igual que en Explorar: filtrar, ordenar y contar en la base, y la app carga los perfiles por id respetando el orden. | Corre con los permisos de quien llama: los perfiles son públicos y los juegos se filtran por `published`. Los topes y los valores por defecto los pone la función. |
| **Orden por defecto: los más nuevos** | Trafal es para quienes recién empiezan; ordenar por seguidores le daría siempre la vitrina a los más conocidos. | «Más seguidos» y «Con más juegos» existen y desempatan entre sí; un orden desconocido es el de por defecto. |
| **El texto busca por comienzo de palabra** en el nombre y en el @usuario (el punto y el guion bajo cuentan como separadores) | «ru» tiene que encontrar «Ruiz» pero no «Bruno»; y «eli pix» tiene que encontrar `eli.pixels`. | De lo que se escribe solo sobreviven letras y números (nunca un comodín ni un operador de búsqueda: `%` no es un comodín). Cada palabra tiene que coincidir. |
| **Los filtros usan lo que dice el perfil**: motor = los que usa, género = los que le gustan (`favorite_genres`) | Es lo que la persona eligió contar de sí; no se infiere de sus juegos. | Quien no completó esos datos no sale al filtrar por ellos (sí sale sin filtros). |
| **Explorar y Creadores van en el menú de arriba**, junto a Comunidad y Subir juego | Eran páginas completas a las que solo se llegaba por el pie de página: lo que la Fase 4 busca es que descubrir sea fácil. Se eligió dejar el menú con solo cuatro secciones (antes dos). | `nav-config.ts` tiene los cuatro enlaces (en celular van dentro de la hamburguesa); la sección queda marcada también al filtrar o buscar dentro de ella. |
| **`FilterForm` único para Explorar y Creadores** | El mismo problema (un formulario GET que manda parámetros vacíos) se resuelve una vez. | Recibe `kind` y arma la dirección corta con el analizador de cada pantalla. |

## Elegir el juego de la semana (2026-11-09)

Migraciones nuevas: `20261108000400_featured_game.sql` y `20261108000500_featured_trigger_guard.sql`. La tabla `featured_games`, su trigger y `moderation_log` ya existían desde la Fase 1.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Dos funciones y ninguna escritura directa**: `set_featured_game(juego, semana, frase)` y `clear_featured_game(semana)` | Elegir lo que ve toda la comunidad es una acción de moderación: tiene que ser de un admin y dejar rastro. Un permiso de tabla no puede exigir ni lo uno ni lo otro. | Ambas exigen un admin con cuenta activa (`private.is_admin()`: una cuenta suspendida no puede) y escriben una línea en `moderation_log` (`feature_game`, `replace_featured_game`, `unfeature_game`). Ni un admin escribe `featured_games` ni edita o borra el registro. |
| **Solo la semana actual o una que viene (hasta 8 semanas)**, y siempre un lunes | Lo pasado es historia, y dejar elegido con tiempo es útil; la semana arranca un lunes (lo exige la tabla). | `week_not_monday`, `week_in_the_past` y `week_too_far`. Elegir de nuevo la misma semana la reemplaza. |
| **Qué se puede elegir lo decide el trigger de la tabla**: un juego publicado marcado como primer juego, y una sola vez en la vida | Es la regla de producto («primer juego»), y vive en la base. | `featured_requires_published_first_game` y `game_already_featured` (unicidad de `game_id`). Un intento fallido no deja nada en el registro. |
| **El trigger solo revalida cuando cambia el juego** (migración `…0500`) | Al borrar la cuenta del admin que eligió, la base pone `chosen_by` en nulo y eso disparaba la validación, que fallaba si el juego se estaba borrando en el mismo momento. | Borrar una cuenta de admin conserva la elección (sin «quién eligió») y su línea del registro. |
| **La portada muestra la elección de esta semana o, si no hay, la última anterior; nunca una de una semana futura** | Elegir con anticipación no tiene que cambiar la portada de hoy. | `findFeaturedGame` filtra `week_start <= lunes de hoy` (`weekStartOf`, en UTC como la base). |
| **Sin pantalla todavía: `tools/featured-game.sh`** | El panel de administración es de la Fase 5; pero la función exige una sesión de admin, así que desde el editor de SQL no se puede llamar. | El script entra con el email y la contraseña del admin (los pide o los toma de `ADMIN_EMAIL`/`ADMIN_PASSWORD`) y llama a las funciones por la API: `show`, `set <id público> [--week …] [--quote …]` y `clear [--week …]`. Sirve igual para producción con `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. |

## Panel de administración (2026-11-09)

Migración nueva: `20261109000100_admin_moderation.sql`. `reports`, `notifications` y `moderation_log` ya existían desde la Fase 1.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Los administradores moderan solo por tres funciones**: `take_report`, `resolve_report` y `moderate_content` | Moderar es una acción que tiene que ser de un administrador y dejar rastro; un permiso de tabla no puede exigir ni lo uno ni lo otro. | Las tres exigen un admin con cuenta activa (`private.require_admin`) y escriben en `moderation_log`. Ningún admin escribe `reports`, `games`, `posts` ni `comments` directamente. |
| **Moderar es ocultar o restaurar, nunca borrar ni editar** | Es reversible: un error de moderación se arregla restaurando. | `hide` solo desde «publicado» y `restore` solo desde «oculto»; un perfil se reporta pero no se oculta desde acá. |
| **Todo ocultar o restaurar lleva un motivo y la autoría lo recibe** | Quien publicó tiene que saber qué pasó y por qué. | Motivo de 1 a 1000 caracteres (`reason_required`); se crea un aviso `moderation` sin actor, con la acción, el tipo y el motivo. |
| **`/admin` no existe para quien no es admin** | No hay que revelar que el panel está ahí. | `requireAdmin` manda al login a los visitantes y responde «no encontrado» al resto; la vista no se indexa. La base vuelve a comprobarlo en cada función. |
| **El panel es una vista de las funciones de la base, con pantallas por dirección** | La seguridad no está en la interfaz. | Filtros y páginas (`?status=`, `?before=`) en la dirección, validados con Zod; el cliente no importa Zod (`admin-rules.ts`). |

## Reportar avances, comentarios y perfiles (2026-11-10)

Migración nueva: `20261110000100_report_published_only.sql`. La tabla `reports` y su trigger ya admitían los cuatro tipos desde la Fase 1.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Un solo diálogo y una sola acción para los cuatro tipos** (`ReportDialog`, `reportContentAction`) | Eran el mismo formulario con otro texto. | El botón de juego, avance (ícono en la tarjeta), comentario y perfil (ícono junto a «Seguir») comparten código; los textos viven en el namespace `report`, que viaja en todas las páginas (`BASE_CLIENT_NAMESPACES`). |
| **Los motivos dependen del tipo** (`REPORT_REASONS_BY_TARGET`): «No funciona» solo para juegos, «Derechos de autor» no para comentarios ni perfiles | Un motivo que no tiene sentido confunde a quien reporta y ensucia la cola. | Lo valida el esquema (Zod); la base acepta todos los motivos. |
| **Solo se reporta lo publicado** (trigger de la base) | El reporte guarda una copia del texto que lee quien reportó (`reports_select`): reportar algo oculto, dado de baja o en borrador, cuyo id alguien conocía, le entregaría ese texto. | `report_target_not_found`, que la interfaz muestra como «Eso ya no está disponible para reportar». |
| **No se bloquea reportar lo propio en la base; la interfaz no ofrece el botón** | No daña a nadie (solo llena la cola de quien lo hace) y evita una regla que complica a los tests que usan una sola cuenta. | Las tarjetas de avances y comentarios y el perfil propio no muestran el botón. |

## Suspensiones (2026-11-10)

Migración nueva: `20261110000200_suspensions.sql`. Las columnas (`status`, `suspended_until`, `suspension_reason`) y `private.can_write()` ya existían desde la Fase 1 y ya frenaban toda escritura.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Dos funciones y ninguna escritura directa**: `suspend_account(cuenta, motivo, hasta)` y `lift_suspension(cuenta, motivo)` | Igual que moderar contenido: tiene que ser de un admin activo y dejar rastro. | Escriben en `moderation_log` (`suspend_account`, `lift_suspension`; la fecha de fin va en el texto) y avisan a la persona con un aviso `moderation` sin nombrar al admin. La persona no puede levantarse la suspensión (no tiene permiso de columna). |
| **No se suspende a la administración ni a uno mismo** | Un admin suspendiendo a otro (o a sí mismo) es una pelea por el control, no moderación; hay un solo rol de admin. | `cannot_suspend_admin` / `cannot_suspend_self`. Un admin que quedara suspendido igual pierde sus poderes (`is_admin()` lo exige activo), por ejemplo si se lo suspende a mano en la base. |
| **El motivo es obligatorio (hasta 500 caracteres) y la persona lo lee** | Nadie debería ser sancionado sin saber por qué. | Se muestra en un aviso en todas las páginas (`SuspensionBanner`) mientras dure. |
| **Una suspensión con fecha vence sola**, sin tareas programadas | `can_write()` y la nueva `private.is_suspended()` comparan con `now()`. | La fila queda «suspendida» pero deja de contar; se puede volver a suspender y no hay nada que levantar. La interfaz usa la misma regla. |
| **Suspender no oculta lo ya publicado** | Ocultar contenido es otra acción, con su propio motivo, y puede ser sobre una parte. | Si hay que sacar contenido, se hace desde el reporte (ocultar y resolver). |
| **El estado de la cuenta se pide una sola vez por pedido** (`getMyAccountState`) | El menú, el aviso de suspensión y el panel lo necesitan: tres consultas iguales en cada página con sesión. | `getIsAdmin` y `getMySuspension` comparten la misma consulta. |
| **La búsqueda de cuentas es por comienzo** (del @usuario o de una palabra del nombre) y limpia el texto | Con la `q` en un patrón `ilike`, `%` y `_` serían comodines. | `parseAccountSearch` deja letras, números, `_` y espacios; el resto se escapa. Hasta 30 resultados. |

## Notificaciones (2026-11-10)

Migraciones nuevas: `20261110000300_notifications.sql` y `20261110000400_notifications_helpful_once.sql`. La tabla, sus políticas y su publicación en realtime ya existían desde la Fase 1.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Las crean triggers de la base**, en la misma transacción del hecho | Un aviso existe si y solo si el hecho ocurrió; el cliente no puede inventarlos ni omitirlos. | Comentario, respuesta, me gusta, seguidor, «Me sirvió» y versión lista o rechazada. No hay permiso de `INSERT` para el cliente. |
| **Nadie recibe avisos de lo que hace él mismo**; una respuesta avisa a quien escribió el comentario y, si es otra persona, también al dueño del juego o avance (como comentario), nunca dos veces a la misma | Evita el ruido. | Lo prueba `23-notifications.test.sql`. |
| **Me gusta y seguidor: uno por persona y cosa; «Me sirvió»: uno por comentario** (índices únicos parciales y `on conflict do nothing`) | Dar y sacar un me gusta, o seguir y dejar de seguir, no debe llenar la campanita de quien lo recibe. | Si la persona descartó el aviso y vuelve a dar me gusta, se vuelve a crear. |
| **Sin agrupar** («3 personas…») ni borrar los viejos | Más simple y más fácil de probar; hoy no hace falta. | Cada hecho es una fila. Limitación conocida: no hay retención (los avisos viejos no caducan solos). |
| **Abrir un aviso es un enlace común a `/api/notifications/<id>`** que lo marca como leído y redirige; no un `Link` del router | Un `Link` se precargaría y marcaría como leído sin que nadie lo abra; además funciona sin JavaScript. | El `id` ajeno no encuentra nada (la base solo muestra los propios) y redirige a la lista. |
| **Un aviso de comentario lleva al comentario**: el enlace termina en `#comment-<id>`, cada comentario de la página tiene ese `id`, y `CommentHighlight` lo centra y lo resalta 4 segundos | Dejar a la persona arriba de la página la obliga a buscar entre decenas de comentarios. | Sin JavaScript queda el ancla del navegador; con él, el resaltado. Respeta «reducir movimiento» (sin desplazamiento suave). Un comentario que ya no se ve (oculto, borrado) lleva a la página sin resaltar nada. |
| **La campanita escucha realtime solo para altas (`INSERT`)** y con la sesión puesta a mano (`realtime.setAuth`) | Sin la sesión el socket entra como anónimo y la base responde «invalid column for filter»; y una suscripción a `UPDATE`/`DELETE` con filtro hace fallar todo el canal. | Marcar o quitar refresca la página desde las acciones. Si no hay conexión, el número es el que cargó la página. |
| **El número de la campanita lo trae el servidor** y el cliente solo suma lo que llega | La portada y las demás páginas siguen sin pedir nada extra al navegador. | `getMyAccountState`, la campanita y el aviso de suspensión comparten consultas por pedido. |

## Límites de uso (2026-11-10)

Migraciones nuevas: `20261110000500_usage_limits.sql` y `20261110000600_usage_limits_writers_only.sql`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Los topes los cuenta y hace cumplir la base** (triggers `BEFORE INSERT` + `private.apply_usage`), no la aplicación | Un tope en la interfaz o en una Server Action se saltea llamando a la API directamente. | Valen igual desde la página, el navegador o `curl`. Los valores viven en una sola función, `private.usage_limits()`. |
| **Un registro propio de eventos (`usage_events`)** y no contar las filas de cada tabla | Si se contara lo publicado, borrar lo recién publicado devolvería el cupo (publicar, borrar, publicar…). | El evento queda aunque se borre el contenido. La tabla no tiene permisos ni políticas; se limpia sola (lo de más de 2 días, de la propia persona, al contar). |
| **Varias ventanas por acción** (por minuto o por hora, y por día) | Frena la ráfaga y el goteo constante. | `usage_limit_exceeded` con el detalle de la acción y, en el `hint`, cuántos segundos faltan para que se libere un lugar. |
| **Solo cuentan las peticiones de una persona con sesión; la administración y el sistema no tienen tope** (`auth.uid()` nulo o admin) | El seed, el worker y las migraciones no son abuso; los admins moderan en ráfagas. | Los tests de la base que usan `service_role` no se ven afectados. |
| **El trigger de topes corre después de los que validan** y un rechazo deshace su propio evento | Un intento inválido no gasta el cupo. | Por orden alfabético de nombre (`comments_before_write` < `comments_usage`). |
| **Quien no puede escribir** (sin perfil o suspendido) **no pasa por los topes** (`not private.can_write()`) | Las políticas de la tabla lo rechazan con su propio error, y el registro tiene una clave foránea al perfil. | Descubierto por el test de seguir sin perfil (migración `…0600`). |
| **La foto de perfil se consulta antes de guardar** (`check_usage('avatar')`, que no registra) | El rechazo tiene que llegar antes de procesar y guardar los bytes, no después. | El registro del evento lo hace el trigger al cambiar `avatar_path`. |
| **El mensaje no dice cuánto esperar** | Cada pantalla tendría que formatear el tiempo en dos idiomas; el `hint` queda disponible para cuando haga falta. | «Esperá un momento / probá más tarde», según la acción. |

## Reclamos de derechos de autor (2026-11-10)

Migración nueva: `20261110000700_copyright_claims.sql`. La tabla y sus permisos (solo lectura para admins) ya existían desde la Fase 1.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Se envía por una función** (`submit_copyright_claim`, ejecutable también por visitantes), no por la tabla | La tabla no tiene permiso de `INSERT` para nadie; la función valida y limita. | La API pública solo ve esa función; la base vuelve a comprobar todo lo que comprobó el servidor. |
| **El formulario es público y sin cuenta** | Quien reclama no tiene por qué tener una cuenta de Trafal. | Para que no sirva para inundar: 3 por día por email (sin distinguir mayúsculas) y 60 por hora en todo el sitio (`too_many_claims`). El captcha se agrega aparte, en el registro y en este formulario. |
| **Tiene que apuntar a algo publicado del sitio**: el servidor lee los enlaces (`parseSiteTarget`: `/games/<id>` o `/posts/<id>`, con o sin `/en`, solo del mismo origen) y manda los ids | Un reclamo sin objetivo no se puede atender; y el enlace es lo único que sabe quien reclama. | `urlsNotOnSite` si ningún enlace es del sitio; la base exige un juego o avance existente y no en borrador (`claim_target_required` / `claim_target_not_found`). Los demás enlaces se guardan como evidencia. |
| **Se maneja con dos funciones auditadas** (`take_claim`, `resolve_claim`), igual que los reportes | Misma regla del repo: los admins no escriben tablas, solo funciones que dejan rastro. | Registro: `take_claim`, `dismiss_claim`, `action_claim`. |
| **Ocultar lo reclamado es la misma moderación de siempre** (`private.apply_moderation`) | Reversible, con motivo, avisa a la autoría y se registra. | Si el reclamo tiene un juego y un avance, se ocultan los dos (los que sigan publicados); `nothing_to_hide` si ya no hay nada publicado. Restaurar se hace desde el mismo reclamo. |
| **La autoría del contenido no ve los datos del reclamante** | Privacidad de quien reclama. | Solo recibe el aviso de moderación con el motivo que escribe el admin; si hace falta, el admin escribe lo que corresponda. No hay contranotificación (ver limitaciones). |
| **No se manda ningún email a quien reclama** | El sitio solo avisa dentro del sitio (decisión de la fase). | Se le da un número de referencia al enviar; el equipo lo contacta por el email que dejó. |
| **Los botones «Tomar» tienen su propio estado de «en curso»** | Compartir el de «Confirmar» dejaba el campo del motivo deshabilitado mientras la pantalla se refrescaba. | Se arregló también en `ReportActions`. |

## Captcha con Cloudflare Turnstile (2026-11-10)

Sin migraciones. Variables nuevas: `TURNSTILE_SITE_KEY` (pública) y `TURNSTILE_SECRET_KEY` (solo del servidor).

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Turnstile**, no reCAPTCHA | Casi nunca pide nada a la persona, no usa cookies de seguimiento y ya estamos en Cloudflare (R2). | El control se carga solo en las dos pantallas que lo usan (`CaptchaField` agrega el script de Cloudflare al abrirlas): ninguna otra página paga ese peso. |
| **Falla cerrado**: un sitio público sin la clave secreta, o un Cloudflare inalcanzable (5 s de espera), rechazan el formulario y lo registran | Un captcha que se apaga solo cuando falla no protege. | Se distingue `missing` / `failed` / `unavailable` / `misconfigured`; la persona ve «verificación no disponible» o «no pudimos comprobar que sos una persona». |
| **En local, sin claves, no hay captcha** (`captchaRequired` = hay clave secreta o el sitio es público, según `isPublicSite`) | Que desarrollar y correr las pruebas no dependa de Cloudflare ni de internet. | El estado «sin claves» solo existe en un sitio que no es público. |
| **El registro lo comprueba Supabase Auth** (se le pasa `captchaToken`), **no la aplicación** | Cada respuesta del captcha sirve una vez: comprobarla en los dos lugares la gastaría. Y la comprobación en la aplicación se saltea llamando a `/auth/v1/signup` directo. | En producción hay que activar el captcha en Supabase con la misma clave secreta (ver `docs/DESARROLLO.md`). Sin eso, el registro no está protegido por captcha. |
| **El formulario de reclamos lo comprueba el servidor** (`verifyTurnstile`) | `submit_copyright_claim` es una función de la base: no tiene dónde comprobar un captcha. | Limitación conocida: alguien que llame a la función directamente se saltea el captcha; siguen valiendo los topes de la base (3 por día por email, 60 por hora). |
| **El botón de enviar espera a la respuesta y el control se reinicia tras cada intento** | La respuesta sirve una vez; sin reiniciar, el segundo intento (por un error de validación) siempre fallaría. | `CaptchaField` recibe un `resetKey` (el resultado de la acción) y avisa al formulario si está listo. |
| **La prueba con Cloudflare es opcional** (`E2E_TURNSTILE=pass\|fail`) | Habla con Cloudflare de verdad (el navegador y el servidor): no debe romper el `check.sh` de quien no tiene internet o claves. | Con las claves de prueba publicadas por Cloudflare se corre a mano; se verificó en los dos modos. |

## Eliminar la cuenta (2026-11-10)

Migración nueva: `20261110000800_account_deletion.sql`. Las claves foráneas en cascada ya existían desde la Fase 1: borrar el usuario de `auth.users` se lleva el perfil, los juegos, avances, comentarios, reacciones, guardados, seguidos, reportes enviados, avisos y el registro de uso.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Una persona borra solo su propia cuenta** con `delete_my_account()` (`SECURITY DEFINER`, usa `auth.uid()`) | El cliente nunca usa la `service_role`, y borrar de `auth.users` hace falta permiso de la base. Sin argumentos: no hay forma de pedir la de otra persona. | Solo `authenticated`. Sin sesión, `not_authenticated`. Los admins reciben `admin_cannot_delete`: tienen que dejar de serlo antes (así el sitio no se queda sin administración por un clic). |
| **Los archivos se borran desde el servidor, por carpetas**, no desde SQL | Supabase Storage no permite borrar objetos desde SQL y R2 tampoco es de la base; hace falta la API S3 con sus credenciales, que son solo del servidor. | `account_files()` devuelve las carpetas de la cuenta (`avatars/<id>/`, `covers/<id>/`, `screenshots/<juego>/`, `posts/<avance>/`, `quarantine/<juego>/`, `games/<id público>/`). |
| **Orden: lista de archivos → borrar la cuenta → borrar los archivos** | Después de borrar, las filas que dicen qué existe ya no están. Si la base falla, no se perdió nada; si el almacenamiento falla, la cuenta ya no existe y quedan archivos sueltos, no una cuenta rota. | `removeAccountFiles` no lanza: registra cada carpeta que no pudo vaciar (`account deletion: could not empty …`) para limpiarla a mano. |
| **Se borra por carpeta con una comprobación estricta**, nunca un bucket entero | Un prefijo vacío o raro alcanzaría todo el bucket. | `deleteStoragePrefix` exige letras, números, guiones y `/` al final; Zod valida lo que devuelve la base; solo borra claves que empiezan con la carpeta. Un test lo prueba. |
| **Se escribe el @usuario para confirmar** | Es irreversible: un clic no alcanza. Sirve igual a quien entró con Google (no tiene contraseña). | El servidor lo vuelve a comprobar (la interfaz solo habilita el botón). |
| **También se borran los avisos que causó la persona** (`actor_id`) | Si no, otras personas quedarían con un aviso «alguien te siguió» sin autor. | El resto de los datos de otras personas (sus juegos, sus avances) no se toca. |
| **Se conserva `moderation_log` y los reclamos de derechos de autor** | El registro es de auditoría (sin clave foránea a propósito) y un reclamo es de quien reclamó, no de la cuenta. | El reclamo queda sin el juego al que apuntaba (`game_id` pasa a nulo); guarda las direcciones que la persona escribió. |
| **La web necesita acceso al bucket de juegos** (`S3_BUCKET_GAMES`) | Los archivos publicados están ahí. | En producción el token de R2 de la web necesita listar y borrar objetos en el bucket de juegos (ver `.env.example`). |

## Documentos legales (2026-11-10)

Sin migraciones: los textos viven en `lib/legal/content/{es,en}.ts` (datos estructurados: secciones con párrafos y listas) y los muestra `components/legal/legal-document.tsx`. `TERMS_VERSION` pasó a `2026-11-10`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Los textos son datos en el código, no mensajes de i18n** | Son largos, con estructura (secciones, listas) y los revisa alguien que no toca la interfaz. | Un test exige que es y en tengan las mismas secciones, en el mismo orden y con la misma forma, ids únicos como anclas y que el español use voseo. Cambiar un texto es cambiar un archivo. |
| **Son un borrador marcado** (`LEGAL_DRAFT` en `lib/legal/status.ts`) | Los redactó el equipo de desarrollo a partir de lo que el producto hace; no sustituyen la revisión de un abogado. | Cada página muestra «Borrador sujeto a revisión legal» hasta que se ponga `LEGAL_DRAFT = false`. |
| **Los datos del titular no se inventan**: `{operator}`, `{email}`, `{jurisdiction}` salen de `LEGAL_OPERATOR_NAME`, `LEGAL_CONTACT_EMAIL` y `LEGAL_JURISDICTION` | No sabemos quién será el titular ni la jurisdicción. | Si falta alguno aparece «[…: a completar]» y un aviso en la página. Son variables públicas de **compilación** (como `SITE_URL`): cambiarlas pide volver a compilar. |
| **El texto describe el producto real** | Una política de privacidad que promete lo que no se hace es peor que ninguna. | Se verificó contra el código y la base: no hay analítica ni publicidad; las cookies son la de sesión y la del idioma; las partidas guardan juego, versión, dispositivo, sesión de página y segundos (sin IP); el registro de moderación y los reclamos se conservan al eliminar la cuenta. Si el producto cambia, hay que cambiar el texto. |
| **`{minAge}` sale de `MIN_AGE`** | La edad mínima vive en un solo lugar. | Los términos y la privacidad nunca contradicen al registro. |
| **Se subió `TERMS_VERSION`** | Cambió el texto que se acepta. | Quien se registre queda con la versión nueva; a las cuentas existentes se les pide aceptarla (ver «Aceptar los términos de nuevo»). |

## Aceptar los términos de nuevo (2026-11-11)

Migración `20261111000100`: `accept_terms(p_terms_version, p_age_confirmed)`. Pantalla `/accept-terms`, aviso en todas las páginas y test e2e `terms-acceptance.spec.ts`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Se compara la versión guardada de la cuenta (`profile_private.terms_version`) con `TERMS_VERSION`** | Ya se guardaba al registrarse y al completar el perfil; no hace falta un dato nuevo. | Subir `TERMS_VERSION` basta para que todas las cuentas con una versión anterior tengan que aceptar. Un test exige que sea una fecha, que no vaya por delante de `LEGAL_UPDATED` y que el seed use la vigente (si no, las cuentas de ejemplo quedarían pidiendo aceptar). |
| **La base solo anota la aceptación** (`accept_terms`, `SECURITY DEFINER`, solo la fila propia) | La tabla no deja escribir esas columnas directo (el permiso es solo de `locale`); quien las cambia tiene que pasar por una función que también pide confirmar la edad. | Anota versión, fecha y confirmación de edad de ahora. Sirve también a cuentas suspendidas y a admins; no cambia rol ni suspensión. La versión que se anota la manda el servidor, nunca el navegador. |
| **Se hace cumplir en la interfaz, no en la base** | Que la base conozca la versión vigente obligaría a una migración en cada cambio de texto y bloquearía de golpe todo lo que escribe (incluidas las cuentas de ejemplo y las pruebas). | Un aviso en todas las páginas (`TermsBanner`) y las pantallas que piden perfil (`requireProfile`) llevan a `/accept-terms?next=…` hasta aceptar. Quien no acepta puede seguir mirando el sitio. |
| **Eliminar la cuenta no se bloquea** (`requireProfile(…, { allowOutdatedTerms: true })` en esa pantalla) | Nadie tiene que aceptar unos términos nuevos para poder irse. | La pantalla de aceptar enlaza a «borrar tu cuenta». |

## Apelaciones (2026-11-11)

Migración `20261111000200`: tabla `appeals` y las funciones `my_decisions`, `submit_appeal` y `resolve_appeal`. Pantalla `/settings/moderation`, cola `/admin/appeals` y test e2e `appeals.spec.ts`.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Se apela lo que se puede deshacer**: la suspensión y lo oculto (juego, avance, comentario) | Son las dos cosas que la administración le hace a alguien, y las dos son reversibles. | Un reporte descartado o un reclamo no se apelan acá. La contranotificación de derechos de autor es otro trámite (la parte reclamada es otra) y queda pendiente. |
| **Nadie escribe `appeals` directo: todo por funciones** | Apelar tiene que funcionar para una cuenta suspendida, que no puede escribir nada; y responder es una acción de moderación. | `submit_appeal` es `SECURITY DEFINER`, solo mira a la propia persona, y `resolve_appeal` pide admin activo. Hay tests de que ni insertar, ni cambiar, ni borrar funciona desde el cliente. |
| **Una decisión es una línea del registro de moderación** | Dos suspensiones o dos ocultados del mismo contenido son decisiones distintas. | Se guarda el id de esa línea en la apelación: una apelación por decisión, y si lo mismo se oculta de nuevo se puede apelar otra vez. No se compara por fecha (dentro de una transacción todas valen lo mismo). |
| **La decisión apelada se copia a la apelación** (motivo, fecha, título o texto) | La pantalla no tiene que leer contenido oculto ni depender de que siga existiendo. | La administración y la persona ven siempre lo que se apeló, aunque después se borre o cambie. |
| **Revertir deshace de verdad y avisa una sola vez** | Que la apelación «prospere» sin que pase nada no sirve. | Se levanta la suspensión o se vuelve a publicar lo oculto, con su línea en el registro («Appeal: …»), y la persona recibe **una** notificación con el resultado y la respuesta (no la de «restauramos» además). Si ya estaba revertido por otro lado, la apelación se responde igual y no se registra un restaurar que no ocurrió. |
| **Responder exige una respuesta escrita** (hasta 1.000 caracteres) | Quien apela merece saber por qué. | Mantener o revertir sin texto no se acepta (en la interfaz y en la base). |
| **Tope de 5 apelaciones en revisión por persona** | Para que la cola no se llene de golpe. | Es un límite simple en la función; no pasa por los límites de uso. |
| **No se avisa a los admins por notificación**, solo con el contador de la pestaña | Hoy los admins entran al panel a trabajar la cola. | Si no entran, no se enteran. |
| **Se actualizó el texto legal** (`LEGAL_UPDATED` = 2026-11-11, `TERMS_VERSION` sigue igual) | Decía que no había trámite de apelación. | El cambio no pide aceptar de nuevo: no quita nada, agrega un trámite. |

## Medios en producción: `nosniff` (2026-11-10)

Sin migraciones ni cambios en la aplicación: es configuración de Cloudflare más una herramienta que la comprueba.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **`nosniff` se pone con una regla de transformación de Cloudflare** sobre el dominio de medios | R2 no permite fijar cabeceras de respuesta por objeto, y el dominio público del bucket no las agrega solo. | Se configura una vez al montar el dominio (pasos en `docs/DESARROLLO.md`). Hasta que se haga, la defensa son las comprobaciones de la subida (`inspectImage` y `post-media`: formato real, nada pegado) y que todo se sube con su `Content-Type` real. |
| **Además se recomienda `Content-Security-Policy: default-src 'none'; sandbox`** en ese dominio | Si un archivo llegara a abrirse como documento, no podría ejecutar nada. | Solo afecta a lo que se abre directo desde el dominio de medios; no a las imágenes y videos que Trafal muestra en sus páginas. |
| **`tools/check-media-headers.sh` comprueba un archivo real** en vez de confiar en la configuración | Una regla mal escrita (otro hostname, otra condición) no da ningún error y deja el sitio sin protección. | Sale con error si falta `nosniff`, el `Content-Type` no es de imagen o video, o no responde 200; la CSP solo avisa. Se corre a mano después de montar o cambiar el dominio. |
| **No se agrega a `check.sh`** | Local no manda `nosniff` (Supabase Storage) y no hay un dominio de producción al que apuntar. | La herramienta sin argumentos prueba la última foto local y marca la falta: es esperable. |

## SEO y tarjetas para compartir (2026-11-09)

Sin migración.

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Un solo lugar arma los metadatos de cada página** (`pageMetadata`) | Cada página repetía a mano (o se saltaba) lo mismo, y el layout declaraba los idiomas alternativos como `/` y `/en` para **todas** las páginas: cada hoja le decía a Google que su versión en inglés era la portada. | Título, descripción, canónica, `hreflang` (con `x-default` en español), Open Graph y Twitter salen de una función; el layout ya no declara alternativos. Las tarjetas de una página **reemplazan** por completo a las del layout (Next no las mezcla), por eso cada una las lleva. |
| **La canónica es siempre la dirección limpia** y las vistas filtradas piden `noindex, follow` | Explorar, Comunidad y Creadores tienen miles de combinaciones de filtros que son la misma página: indexarlas diluye todo. | La canónica de `/explore?genre=arcade` es `/explore`; el `<meta robots>` de las variantes lo pone `NoIndex` dentro de la vista (leer `searchParams` en `generateMetadata` obligaría a envolver todo en `Suspense`). Las pantallas de acceso, los seguidores y las páginas que no existen tampoco figuran. |
| **Imagen generada por página** (`opengraph-image.tsx` de la portada, el juego, el perfil y el avance, con `next/og`) y no la portada del juego | La portada vive en el almacenamiento y desde el contenedor web no es alcanzable con la misma dirección que ve el navegador; además, una tarjeta propia es predecible y de peso chico (≈ 55 KB). | Solo texto plano recortado (nunca HTML de nadie), en el idioma de la página, con los textos en `messages` (`og`). Sin negrita: la fuente por defecto de `next/og` es una sola. Cada tarjeta es `1200 × 630` y se mira con `e2e`. |
| **Las rutas de imagen pasan por el `proxy`** | El `matcher` excluía `opengraph-image` y, como Next genera `/es/…`, la portada en español redirigía a una dirección que quedaba sin idioma y daba 404. | Se sacó esa exclusión del `matcher`. Las imágenes salen con `/es/…` (Next la redirige a la dirección limpia, que ya funciona). |
| **Un sitio que no es público se cierra por completo en `robots.txt`** (`isPublicSite`) | Una copia de pruebas con una dirección real indexada compite con la verdadera y filtra datos de prueba. | `localhost`, `127.0.0.1`, `0.0.0.0`, `.local`, `.test`, `.internal` y direcciones inválidas dan `Disallow: /`. En producción, `SITE_URL` con el dominio real abre el sitio salvo las zonas privadas (y en cada idioma). |
| **Datos estructurados con `schema.org`** y serializados a mano (`serializeStructuredData`) | Los buscadores muestran más (videojuego gratis en el navegador, persona, publicación) y el texto de una persona va dentro de un `<script>`. | Se escapan `<`, `>`, `&` y los separadores de línea Unicode, así que ni `</script>` en una bio puede cerrar la etiqueta (probado en unitarios y en `e2e` con una cuenta real). |
| **El sitemap lista juegos, creadores y avances publicados, en los dos idiomas, con las traducciones** | Es lo que ayuda a descubrir las páginas profundas. | Máximo 5000 de cada clase por ahora (un archivo admite 50 000 direcciones y cada una va dos veces); pasado eso hay que dividirlo con `generateSitemaps`. Se lee como cualquier visitante (solo datos públicos). |

## Rendimiento y Lighthouse (2026-11-09)

Sin migración. Herramienta: `tools/lighthouse.sh` (ver `docs/DESARROLLO.md`).

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **Se mide contra la versión de producción**, con una dirección «pública» de mentira (`trafal.example`, que Chrome resuelve a `127.0.0.1`) | En desarrollo los números no significan nada; y con `localhost` el sitio se cierra por completo a los buscadores (`robots.txt`), así que el SEO se mediría mal. | `tools/lighthouse.sh` compila la imagen `prod`, la levanta en `:3100`, corre Lighthouse (celular: la medición exigente; escritorio) con la mediana de 3 corridas y deja los informes en `lighthouse-reports/`. |
| **El mínimo (85 de rendimiento en celular) se exige en la portada y en la página de un juego**; las demás se miden y se informan | Son las páginas del criterio de la fase. `/feed` depende de los datos: una imagen de 500 KB al principio de la lista pesa más que todo el JavaScript. | La herramienta falla si una página exigida baja de 85 y avisa de las demás (`GATED`). |
| **Zod no viaja al navegador** | Pesaba ~31 KiB comprimidos en todas las páginas, solo porque los componentes de cliente importaban constantes de módulos que también traían los esquemas. | Las constantes y tipos que usa la interfaz viven en `*-rules.ts` (sin Zod) y los módulos de validación las reexportan; `parseSearchQuery`, `parseExploreQuery` y `parseCreatorsQuery` no usan Zod. |
| **El cliente de Supabase del navegador se carga la primera vez que se usa** (`loadBrowserClient`) | Eran ~71 KiB comprimidos en la página de cada juego, y solo se usan al tocar «Jugar» y al comprobar un @usuario. | Esa parte sale del JavaScript inicial. |
| **Los textos que viajan al navegador son por pantalla** (`BASE_CLIENT_NAMESPACES` + `<ExtraMessages>`) | Todas las páginas cargaban 27 KB de textos de formularios (dos veces en el HTML por la renderización parcial). | La base son 8 namespaces (< 10 KB); cada pantalla pide los suyos. En desarrollo, un componente que usa un namespace que su pantalla no pidió **lanza un error claro**, y un test recorre el código y exige que todo `useTranslations("x")` de cliente esté en la lista. |
| **Los metadatos siempre llegan en el `<head>`** (`htmlLimitedBots: /.*/`) | Con el modo por defecto de Next, un cliente que no está en su lista de buscadores recibe la descripción y las tarjetas más tarde, dentro del cuerpo: Lighthouse marcaba «sin meta description» en juegos y perfiles. | El costo es que el `<head>` espera los datos de la página (ya se piden igual: `cache` de React los comparte); el tiempo hasta el primer byte quedó igual de bajo (~15 ms). |
| **Los esqueletos de las páginas con datos son altos** (`min-h-svh`) | Al llegar el contenido, el pie de página (visible bajo un esqueleto corto) saltaba: CLS de 0,18 en la página del juego. | CLS 0 en todas las páginas. |
| **La primera imagen de una página se pide con prioridad** (`eagerMedia`: `loading=eager` y `fetchPriority=high` solo en la primera) y el resto sigue perezoso | Una imagen perezosa por encima de la línea de flote espera a que el navegador la descubra: 5 s de demora en el feed. | Lo hace el feed (primera tarjeta) y la página de un avance. |

## Limitaciones conocidas

- **Perfil inexistente → HTTP 200 con `noindex`** (no 404): el contenido llega por streaming y el status ya se envió. Es inherente a Cache Components; el buscador no lo indexa.
- **Rutas protegidas**: para quien no tiene sesión la redirección ocurre dentro del streaming (`<meta refresh>`/JS), no con un 307 previo. No se filtra contenido.
- **Fuentes**: se bajan de Google Fonts al compilar/arrancar (`next/font/google`) y se sirven desde nuestro dominio.
- **Supabase local** publica puertos en todas las interfaces y Studio no tiene contraseña: solo para desarrollo.
- **Fotos de perfil**: el servidor valida pero **no recodifica** la imagen (una recodificación con `sharp` sacaría metadatos EXIF de archivos hechos a mano; el flujo normal ya los pierde al pasar por el canvas). No hay tope de subidas por minuto (lo cubre la Fase 5, junto con el resto de los límites). Dos subidas simultáneas pueden dejar un archivo huérfano.
- **Subidas interrumpidas**: una versión que quedó en «Subiendo» (la persona cerró la página) no se limpia sola todavía, y su archivo parcial en cuarentena expira por la regla de ciclo de vida del bucket (24 h en producción).
- **Reproductor**: los juegos de ejemplo del seed tienen versiones «listas» pero no archivos: al jugarlos el marco muestra «Not found». Un Godot con hilos (`needs_isolation`) no se puede jugar todavía (hace falta la ruta de pantalla completa con COOP/COEP). El creador no puede probar un borrador. El conteo de partidas se puede inflar abriendo muchas sesiones: los límites de uso son de la Fase 5.
- **Worker**: no hay un tope de tiempo por versión (solo el de 10 minutos tras el cual otro worker puede retomarla) ni un límite de egreso de red del contenedor; y los archivos publicados todavía no se sirven: falta el gateway y el reproductor.
- **Sin selector de idioma**, quien no tiene cuenta solo puede cambiarlo con el idioma de su navegador o escribiendo `/en` en la URL (es lo que se pidió).
- **Cookies entre juegos**: cada juego tiene su propio origen (`<id>.<dominio de juegos>`), así que `localStorage`, IndexedDB y las cookies de cada uno están separados. Pero un juego **puede poner una cookie con `Domain=<dominio de juegos>`** que verían los demás juegos del mismo dominio (en local con `games.localhost` no se nota). Para producción hay que registrar el dominio de juegos en la **Public Suffix List** (como `github.io`), así el navegador rechaza esas cookies; hasta entonces no hay nada sensible en ese dominio (el sitio vive en otro dominio y nunca le llega una cookie).

- **Avances**: los videos MP4 y los GIF no se transcodifican ni se les saca la metadata (un MP4 de un celular puede traer la ubicación en sus cajas `udta`); tampoco se limpian los WebP. No hay tope de publicaciones por minuto ni por día (límites de uso: Fase 5). Un fallo del almacenamiento al borrar un avance deja un archivo huérfano.
- **Preguntas del creador**: se escriben solo al subir el juego; no hay todavía una pantalla para cambiarlas, agregarlas o borrarlas después (la base ya lo permite al dueño).
- **Rendimiento del feed**: las imágenes de los avances se sirven tal como se subieron (hasta 5 MB). Con una imagen grande al principio de la lista, el rendimiento en celular baja de 85 (es una limitación de los datos, no del código). La solución es generar variantes reducidas al subir (o usar el optimizador de imágenes de Next con el dominio público de R2); queda para una pieza aparte.
- **Captcha**: sin activar el captcha en la configuración de Supabase (producción), el registro no queda protegido contra llamadas directas a la API; el formulario de reclamos se comprueba solo en el servidor de la aplicación.
- **Medios en producción**: nada en el repositorio obliga a que la regla de Cloudflare exista; solo se comprueba a mano con `tools/check-media-headers.sh`. Si se cambia el dominio de medios, hay que repetir la regla y la comprobación.
- **Documentos legales**: son un borrador sin revisión legal; hacen falta el titular, el email de contacto y la jurisdicción. No hay un trámite de contranotificación formal (los textos mandan a escribir al email de contacto). Las páginas no se pueden descargar ni imprimir con un formato propio.
- **Aceptar los términos de nuevo**: lo hace cumplir la interfaz (aviso y pantallas con perfil), no la base: quien ya tiene una pantalla abierta, o llama a la API directo, puede seguir escribiendo hasta que recargue o acepte. No queda un historial de aceptaciones, solo la última (versión y fecha); no se explica qué cambió entre versiones.
- **Apelaciones**: no hay contranotificación de derechos de autor ni se apelan los reportes descartados; no hay apelación de segunda instancia (una por decisión); no se avisa por email ni a la persona ni a la administración, y la administración no recibe notificación de una apelación nueva (solo el contador del panel); quien responde puede ser el mismo admin que tomó la decisión.
- **Eliminar la cuenta**: no se pide la contraseña ni hay un período de gracia para arrepentirse (la sesión abierta alcanza, más el @usuario escrito); si el almacenamiento falla después de borrar la cuenta, quedan archivos huérfanos que solo se ven en el registro del servidor. No se avisa por email que la cuenta se eliminó, ni se ofrece descargar los datos antes. Lo que otras personas comentaron en tus juegos o respondieron a tus comentarios se borra con ellos.
- **Reclamos de derechos de autor**: no hay contranotificación (que la autoría responda al reclamo y pida restaurar) ni aviso por email a quien reclama; los textos legales son un borrador hasta que los revise un abogado.
- **Lighthouse en local**: la categoría «buenas prácticas» marca 79 porque se mide por HTTP (no hay HTTPS en la prueba); en producción con HTTPS no aplica.
