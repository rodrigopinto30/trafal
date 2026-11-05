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

## Limitaciones conocidas

- **Perfil inexistente → HTTP 200 con `noindex`** (no 404): el contenido llega por streaming y el status ya se envió. Es inherente a Cache Components; el buscador no lo indexa.
- **Rutas protegidas**: para quien no tiene sesión la redirección ocurre dentro del streaming (`<meta refresh>`/JS), no con un 307 previo. No se filtra contenido.
- **Fuentes**: se bajan de Google Fonts al compilar/arrancar (`next/font/google`) y se sirven desde nuestro dominio.
- **Supabase local** publica puertos en todas las interfaces y Studio no tiene contraseña: solo para desarrollo.
- **Fotos de perfil**: el servidor valida pero **no recodifica** la imagen (una recodificación con `sharp` sacaría metadatos EXIF de archivos hechos a mano; el flujo normal ya los pierde al pasar por el canvas). No hay tope de subidas por minuto (lo cubre la Fase 5, junto con el resto de los límites). Dos subidas simultáneas pueden dejar un archivo huérfano.
- **Al borrar una cuenta** (Fase 5) hay que borrar también `avatars/<id>/`: la base elimina el perfil en cascada, pero no toca el almacenamiento.
- **En producción**: el dominio público de R2 tiene que servir `X-Content-Type-Options: nosniff` (regla de transformación de Cloudflare) para que un archivo con forma de imagen nunca se interprete como otra cosa.
- **Sin selector de idioma**, quien no tiene cuenta solo puede cambiarlo con el idioma de su navegador o escribiendo `/en` en la URL (es lo que se pidió).
