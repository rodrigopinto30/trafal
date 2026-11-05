# Guía de desarrollo

Cómo levantar, probar y entender el código de Trafal. Qué hace la aplicación está en el [README](../README.md); la arquitectura de alojamiento de juegos, en [ARQUITECTURA.md](ARQUITECTURA.md).

## Levantarlo

Lo único que necesitás instalado es **Docker** (con Compose v2) y unos 4 GB de RAM libres. Node, pnpm y el CLI de Supabase corren dentro de contenedores o se descargan solos.

```bash
./start.sh        # la primera vez baja imágenes (unos minutos)
```

| Qué | Dónde |
|---|---|
| **Web** | http://localhost:3000 (el idioma sale de tu navegador; se cambia en *Configuración*, o con `/en`) |
| Correo de pruebas — acá llegan los mails de confirmación | http://localhost:54324 |
| Supabase Studio (explorar la base) | http://localhost:54323 |
| API de Supabase | http://127.0.0.1:54321 |

**Cuentas de prueba** (contraseña `trafal123`): `valen@trafal.test` (@valen_makes), `mateo@trafal.test` (@mateo_g) y `admin@trafal.test` (@equipo_trafal, admin). Hay otras siete (`sofi@`, `nacho@`, `juli@`, `caro@`, `tomi@`, `male@`, `santi@` + `trafal.test`) que son creadoras de los **16 juegos de ejemplo** que llenan la portada. Son datos de desarrollo: `./start.sh --reset` los carga.

**Para ver el flujo completo de un registro nuevo:** *Crear cuenta* (hay que tener 18 años o más y repetir la contraseña) → abrí http://localhost:54324 → tocá el link del mail → elegí tu @usuario (si está libre, es tuyo: no hacen falta números) → ya tenés perfil. Después, desde el menú de tu cuenta, entrá a *Configuración*: ahí cambiás tu **foto**, tus datos, los **géneros** que te gustan (tocá para elegir, tocá de nuevo para sacar) y el **idioma**. Probá también *Seguir* en el perfil de otra persona.

```bash
./stop.sh                 # baja todo y conserva tus datos
./stop.sh --purge         # baja todo y BORRA la base (empezar de cero)
./start.sh --reset        # recrea la base desde las migraciones + seed
./start.sh --prod         # la web compilada, como en producción
```

## Verificar que todo anda

```bash
./check.sh                # lint + tipos + tests unitarios + worker de Python + tests de la base (RLS/permisos) + tipos de la DB al día
./check.sh --e2e          # además, pruebas de punta a punta con Playwright (~2 min)
./pnpm test               # solo los tests unitarios
tools/worker-check.sh     # solo el worker de Python (ruff, mypy estricto, pytest), en Docker
tools/validate-zip.sh juego.zip   # valida un zip con las reglas de subida y muestra el resultado en JSON
./pnpm add <paquete>      # pnpm dentro del contenedor (no hace falta Node en tu máquina)
```

Qué cubren los tests:

- **Base de datos (pgTAP, 374 aserciones):** quién puede leer/escribir cada tabla, por rol (visitante, dueño, otra persona, admin, cuenta suspendida). Un test de invariantes falla si alguien agrega una tabla sin RLS o abre una columna protegida al cliente. Se probó rompiendo permisos a propósito: los tests lo detectan.
- **Worker de Python (pytest, 95):** el validador de zips contra archivos armados a mano a nivel de bytes: rutas con `..`, absolutas, con barra invertida, con caracteres de control o de dirección; symlinks y archivos especiales; ejecutables (por extensión y por bytes iniciales, también disfrazados); zips anidados; cifrados; zip-bombs (tamaño declarado falso, entradas que se pisan, millones de entradas); nombres duplicados por mayúsculas o Unicode; `index.html` obligatorio. Más la paridad entre el JSON de reglas y los códigos de error.
- **Unitarios (Vitest, 319):** esquemas de **Zod** y saneado de texto, reglas del @usuario (con paridad contra la migración), **inspección de imágenes** (PNG/JPEG/WebP manipulados, animados, con datos pegados), recorte de la foto, i18n (paridad es/en, voseo), seguridad de redirecciones, **contraste de colores ≥ 4,5:1 de toda la paleta** y que no haya caracteres invisibles en el código.
- **Punta a punta (Playwright, 216 = 108 × 2 tamaños; las 16 que miden el cursor o las barras de scroll reales solo corren en escritorio):** registro (18+, contraseña repetida) → mail → onboarding (@usuario libre sin números, sugerencias) → configuración (foto, géneros, idioma) → seguir → cerrar sesión; **el buscador de la portada** (sugerencias, teclado, tildes, texto hostil, inglés) y que **el menú de la cuenta y los avisos de «guardado» no muevan ni repitan nada**; **el servidor rechaza fotos manipuladas** (HTML disfrazado, SVG, tamaño o tipo falso, animadas, con datos pegados); el idioma sale del sistema y se cambia en Configuración; la **manito en todo lo clickeable** (se mide el cursor real); rutas protegidas; sin scroll horizontal a 360 px; objetivos táctiles ≥ 44 px; auditoría de accesibilidad **axe WCAG 2.2 AA** en 12 pantallas, en escritorio y celular.

## Variables de entorno

`./start.sh` crea `.env` desde [`.env.example`](../.env.example) la primera vez. Todo tiene un valor que funciona en local.

| Variable | Para qué | Por defecto |
|---|---|---|
| `SITE_URL` | URL pública del sitio (links de los mails, redirecciones, metadatos) | `http://localhost:3000` |
| `WEB_PORT` | Puerto donde se publica la web | `3000` |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | Login con Google (opcional) | vacío (botón oculto) |
| `S3_*`, `MEDIA_PUBLIC_URL` | Dónde se guardan las fotos (S3 compatible: en producción, Cloudflare R2) | las genera `./start.sh` (S3 de Supabase Storage); ver `.env.example` para producción |

Las claves y URLs de Supabase **no** se configuran a mano: `start.sh` las lee de Supabase y las deja en `.env.supabase` (generado, ignorado por git; incluye las credenciales del almacenamiento local). El navegador usa `http://127.0.0.1:54321`; el servidor de Next, dentro de Docker, usa la red interna (`SUPABASE_INTERNAL_URL`) y, para guardar imágenes, `host.docker.internal:54321`.

### Login con Google

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) creá un *ID de cliente de OAuth* de tipo **Aplicación web**.
2. Agregá como URI de redirección autorizado: `http://127.0.0.1:54321/auth/v1/callback`.
3. Pegá el ID y el secreto en `.env` (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `…_SECRET`).
4. Reiniciá: `./stop.sh && ./start.sh`. El botón «Continuar con Google» aparece solo.

## Cómo está armado

```
trafal/
├─ start.sh · stop.sh · check.sh · pnpm        scripts (todo corre en Docker)
├─ docker-compose.yml · docker/{web,worker}.Dockerfile
├─ apps/web/                                   Next.js 16 · TypeScript estricto · Tailwind 4 · shadcn
│  ├─ src/app/[lang]/…                         páginas (el idioma es el segmento raíz)
│  ├─ src/proxy.ts                             idioma (es sin prefijo, /en) + refresco de la sesión
│  ├─ src/components/{ui,brand,layout,auth,profile,settings}
│  ├─ src/i18n/                                i18n propio (plurales ICU, rutas con idioma)
│  ├─ src/messages/{es,en}.json                textos (español rioplatense con voseo + inglés)
│  └─ src/lib/{supabase,auth,profile,settings} clientes, capa de acceso a datos, Server Actions
│     └─ {validation,media,storage}            Zod + saneado · fotos (recorte, inspección) · cliente S3
├─ supabase/
│  ├─ migrations/                              esquema completo + RLS (7 migraciones)
│  ├─ tests/database/                          pgTAP: permisos de cada tabla
│  ├─ templates/                               mails bilingües con la identidad de Trafal
│  └─ seeds/                                   10 cuentas, 16 juegos, 30 avances y comentarios de ejemplo
├─ worker/                                     Python 3.13 sin dependencias de ejecución: validador de zips de juegos
│  ├─ src/trafal_worker/                       reglas, directorio central, rutas, planificador, verificador, CLI
│  └─ tests/                                   pytest (con un armador de zips a mano para los casos maliciosos)
├─ packages/shared/upload-rules.json           reglas de subida: fuente única (límites, extensiones, códigos de error)
├─ e2e/                                        Playwright (corre en la imagen oficial)
├─ tools/                                      db-types.sh (tipos desde el esquema) · worker-check.sh · validate-zip.sh
└─ docs/                                       ARQUITECTURA.md · DATABASE.md · DECISIONS.md · DESARROLLO.md
```

- **Next.js 16 con Cache Components + prefetch parcial:** cada página tiene un caparazón estático (nav, footer, marco) que llega al instante y lo que depende de la sesión llega por *streaming* dentro de `<Suspense>`. El `next build` falla si algo lee cookies/params fuera de un `<Suspense>`.
- **La seguridad vive en la base de datos:** RLS en todas las tablas y permisos por columna, no en la interfaz. Detalle en [docs/DATABASE.md](DATABASE.md).
- **Diseño:** tokens en [`globals.css`](../apps/web/src/app/globals.css) (colores de la marca, Oxanium / Space Grotesk / Pixelify Sans, brillo neón, cursor pixelado, aurora y píxeles flotantes que se apagan en celular y con `prefers-reduced-motion`).

Las decisiones de diseño y por qué se tomaron están en [docs/DECISIONS.md](DECISIONS.md).

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| «Docker no responde» | Arrancá Docker; en Linux tu usuario tiene que estar en el grupo `docker`. |
| Un puerto está ocupado (3000, 54321–54324) | Cambiá `WEB_PORT` en `.env`; para Supabase, cerrá lo que use esos puertos. |
| Quedó un estado raro | `./stop.sh --purge && ./start.sh` (empieza de cero). |
| El login con Google no aparece | Revisá que las dos variables de Google estén en `.env` y reiniciá. |
| «No pudimos guardar la foto» | El servidor guarda las imágenes en el S3 de Supabase Storage: tiene que estar corriendo (`./start.sh`) y el contenedor web necesita `host.docker.internal` (ya está en `docker-compose.yml`). `./start.sh` también crea el bucket `media`. |

> **Aviso (solo desarrollo):** Supabase local publica sus puertos en todas las interfaces y Studio no tiene contraseña. No lo uses en redes que no sean de confianza.
