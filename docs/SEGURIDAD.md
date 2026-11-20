# Revisión de seguridad (2026-11-19)

Revisión completa del código con el criterio del **OWASP Top 10** (2021 y 2025) y el nivel 2 del **ASVS**. Rama `feat/tradfal-rebrand-and-hardening`.

## Cómo se hizo

- **Herramientas automáticas** (en Docker, locales):
  - `pnpm audit` (dependencias de npm);
  - `pip-audit` (dependencias del worker);
  - `gitleaks` (claves filtradas en las 93 versiones del historial y en la carpeta de trabajo);
  - `semgrep` con las reglas de OWASP, TypeScript, React, Next.js, Python, Docker y secretos.
- **Cinco revisiones manuales**, una por área:
  - control de acceso y base de datos (A01);
  - inyección, XSS y validación (A03);
  - subidas, worker, servidor de juegos y sandbox (A04, A05, A08);
  - login, sesiones, CSRF y antiautomatización (A07);
  - configuración, cabeceras, secretos, SSRF y dependencias (A02, A05, A06, A09, A10).
- **Cada hallazgo se comprobó** antes de arreglarlo, con consultas dentro de transacciones que se deshacen, mediciones o la lectura del código. Cada arreglo tiene su prueba.

## Lo que encontraron las herramientas

| Herramienta | Resultado |
|---|---|
| `pnpm audit --prod` | Sin vulnerabilidades. El único aviso (`minimatch`, moderado) venía de `shadcn`, que estaba en `dependencies` aunque solo se usa al compilar el CSS: pasó a `devDependencies`. |
| `pip-audit` | Sin vulnerabilidades. |
| `gitleaks` | Ninguna clave en el historial. Los 2 avisos son tokens de prueba (`0123456789abcdef…`); en la carpeta de trabajo, solo archivos que git ignora (`.next`, `.pnpm-store`, `.env.supabase`). |
| `semgrep` | 4 avisos. La imagen de desarrollo de la web corre como root, pero compose la corre con el usuario del host. Además, 3 ajustes de pnpm contra paquetes maliciosos: aplicados. |

## Hallazgos

Estados posibles: **Arreglado**; **Mitigado** (el riesgo bajó mucho, queda algo menor); **Aceptado** (se decidió dejarlo, con el porqué); **Pendiente** (se hace en otra pieza o es un paso de producción).

### Alta

| # | Qué pasaba | Arreglo | Estado y prueba |
|---|---|---|---|
| 1 | **ReDoS**: la limpieza de textos largos (`sanitizeMultiline`) era cuadrática con muchos espacios seguidos. Un solo pedido sin cuenta (el formulario público de reclamos) podía trabar el servidor unos 10 minutos. Medido: 40.000 espacios tardaban 0,9 s. | Paso lineal (`split` + `trimEnd`) y tope de 50.000 caracteres antes de limpiar cualquier texto. | Arreglado. `lib/validation/text.test.ts`: 1 millón de espacios en menos de medio segundo. |

### Media

| # | Qué pasaba | Arreglo | Estado y prueba |
|---|---|---|---|
| 2 | **Redirección abierta**: `?next=/en//sitio-malo` pasaba el filtro y, al sacarle el idioma, quedaba `//sitio-malo`. Servía para llevar a alguien a otro sitio después del login. | `isInternalPath` rechaza `//` y `\` en la ruta, y `localizePath` nunca devuelve dos barras adelante. | Arreglado. `i18n/path.test.ts`. |
| 3 | **El dueño editaba un juego oculto o dado de baja** llamando directo a la API (título, descripción, preguntas, cambios de versión), y podía subir versiones y elegir cuál se juega. Así podía «limpiar» lo reportado antes de apelar. | Políticas y funciones: solo se cambia un juego en borrador o publicado. | Arreglado. pgTAP `32-security-hardening`. |
| 4 | **Borrar la cuenta** pedía la contraseña solo en la web: la función de la base se podía llamar con cualquier sesión abierta. | La base exige un ingreso de menos de 10 minutos. La web borra con un ingreso nuevo hecho con la contraseña; una cuenta de Google o Discord tiene que volver a entrar. | Arreglado. pgTAP `26` y `32`; e2e `account-deletion`. |
| 5 | **Cambiar la contraseña** se podía con cualquier sesión abierta, no solo con la del link del mail: en una compu ajena alguien se quedaba con la cuenta. | `/reset-password` solo acepta la sesión del link del mail (método `otp`, menos de 15 minutos) y muestra de qué cuenta es. Además, `secure_password_change = true`. | Arreglado. e2e `auth`. |
| 6 | **Captcha**: activarlo en Supabase, como decía la guía, rompía el login, la recuperación de contraseña y el borrado de cuenta (no mandaban el captcha). Sin activarlo, esos formularios no tenían protección contra bots. | Los cuatro formularios (registro, login, recuperación y borrado) mandan su captcha, cada uno con su acción. | Arreglado. En producción hay que activarlo en Supabase (ver abajo). |
| 7 | **Cookie de sesión sin `Secure`, sin HSTS y sin Content-Security-Policy**: un pedido por http en una red hostil mandaba el token en claro, y cualquier XSS habría podido llevarse la sesión. | Cookie `Secure` cuando el sitio es https; HSTS y `Cross-Origin-Opener-Policy`. CSP con orígenes cerrados (`lib/security/csp.ts`, puesta por el proxy) para scripts, conexiones, marcos, formularios, `object` y `base`. | Arreglado. `csp.test.ts`; `quality.spec` comprueba que ninguna página viole la CSP. |
| 8 | **Límites de Supabase Auth compartidos**: todas las peticiones de login le llegan desde la IP del servidor web, así que un atacante agotaba el límite para todos. | El captcha en login y recuperación hace caro cada intento. | Mitigado. En producción: una regla de límite en Cloudflare para los POST de `/login` y `/forgot-password`, y subir los límites de Supabase Auth. |
| 9 | **Lo que la moderación oculta seguía público**: las imágenes, GIF y videos de un juego o avance ocultado (también por derechos de autor) seguían abriéndose por su dirección. | Al ocultar, el servidor mueve esos archivos a un bucket privado (`media-hidden`); al restaurar, los devuelve. Borrar una cuenta o un avance limpia los dos buckets. | Arreglado. `media.server.test.ts`, `s3.server.test.ts` y una prueba real (la dirección deja de abrir y vuelve igual). En producción: crear el bucket y purgar la caché de Cloudflare (ver abajo). |
| 10 | **El canal de reclamos se podía trabar**: la función es pública (no hace falta cuenta) y, llamada directo, salteaba el captcha. 60 reclamos falsos por hora lo cerraban para todos, y los links aceptaban cualquier esquema. | La base solo acepta reclamos con la clave del servidor (`CLAIMS_SERVER_KEY`, guardada como SHA-256 en `private.server_keys`), y la web la manda después del captcha. Links solo http(s) y textos sin caracteres invisibles. | Arreglado. pgTAP `25`, `29` y `32`. |
| 11 | **Servidor de juegos**: un `.svg` o `.xml` del juego se abría como página suelta (con scripts) en el dominio de juegos, lo que servía para phishing. | Esos tipos se tratan como el HTML: abiertos como página, llevan a la página del juego en Tradfal. Como imagen o datos se siguen sirviendo, con `CSP: sandbox`. | Arreglado. `apps/gateway/test/handler.test.ts`. |
| 12 | **Servidor de juegos**: una petición con la dirección en forma absoluta o un `Host` malformado tiraba abajo el proceso. | `toRequest` (`node-request.ts`) no lanza: responde 400. | Arreglado. `node-request.test.ts`. |
| 13 | **Cupo diario de subidas**: se esquivaba borrando juegos (sus versiones dejaban de contar), y los archivos de los juegos borrados quedaban para siempre en el bucket. | No se puede borrar directo un juego que ya tiene versiones (el formulario solo deshace subidas fallidas). Las versiones de una misma persona se crean de a una (lock). | Arreglado. pgTAP `32`. |
| 14 | **Node 24.22.2**: le faltaba el release de seguridad 24.22.3 (http, http2 y tls). | Imágenes fijadas a `node:24.22.3` y `python:3.13.18`; `./start.sh --build` hace `--pull`. | Arreglado. |
| 15 | **Worker sin TLS verificado hacia Postgres**: con una base remota, libpq cae a texto plano y acepta cualquier certificado. | El worker no arranca con una base remota sin `sslmode=verify-full`. | Arreglado. `worker/tests/test_worker.py`. |
| 16 | **Entorno local abierto a toda la red Wi-Fi**: Postgres con la contraseña por defecto, Studio sin login y Mailpit con los mails de recuperación, también por DNS rebinding. | La web y los juegos quedan atados a `127.0.0.1` (`WEB_BIND`/`GAMES_BIND` para abrirlos). El CLI de Supabase no tiene opción para atar sus puertos: ver la regla de firewall abajo. | Mitigado. |

### Baja

| # | Qué pasaba | Arreglo | Estado |
|---|---|---|---|
| 17 | Cualquiera veía qué admin eligió el juego de la semana. | Sin permiso de lectura de `featured_games.chosen_by`. | Arreglado. |
| 18 | Quien hizo un reporte o una apelación ve qué admin la resolvió. | El panel necesita esa columna y los admins comparten rol; ocultarla exigiría pasar el panel a funciones. | Aceptado. |
| 19 | Columnas internas de las versiones legibles por cualquiera (señales de la revisión, clave de cuarentena, bloqueo del worker). | Lectura por columna; el dueño pide la dirección de subida con `version_upload_target`, que además comprueba que pueda escribir. | Arreglado. pgTAP `08` y `32`. |
| 20 | El juego de la semana de semanas futuras era legible por la API. | Política: solo hasta la semana actual (los admins ven todas). | Arreglado. |
| 21 | Nombres como `tradfal_oficial`, `soporte_ya` o `ana.admin` estaban libres. | Reservado todo nombre que contenga el del sitio o que tenga una parte del equipo (`admin`, `soporte`, `equipo`…). | Arreglado. pgTAP `32`, `username.test.ts`. |
| 22 | La limpieza de texto solo estaba en la web (por la API entraban caracteres de dirección, de ancho cero o de control), y la lista dejaba pasar varios invisibles. | CHECK en la base para todo el texto público y lista ampliada en la web; un test las mantiene iguales. | Arreglado. |
| 23 | «Olvidé mi contraseña» revelaba si una cuenta existía (por el límite de mails). | Solo se informan el límite por IP y el captcha. | Arreglado. |
| 24 | Un link de mail ajeno reemplazaba la sesión abierta (login CSRF). | Solo se aceptan los tipos de link que mandan los mails, y la pantalla de contraseña muestra de qué cuenta es. | Mitigado. |
| 25 | Códigos de mail de 6 dígitos válidos por 1 hora, adivinables por la API. | 10 dígitos (`otp_length`). | Arreglado (en producción, el mismo valor en el panel). |
| 26 | Política de contraseñas débil (8 caracteres, letras y números). | Activar la protección de contraseñas filtradas de Supabase (plan Pro) o subir el mínimo. | Pendiente. |
| 27 | Las páginas de administración comprobaban el rol solo en el layout. | Cada página llama a `requireAdmin`. | Arreglado. |
| 28 | Turnstile no comprobaba el sitio ni la acción, ni mandaba la IP. | En un sitio público se exigen el `hostname` y la acción; se manda `remoteip`. | Arreglado. `verify.test.ts`. |
| 29 | La contraseña del worker quedaba en texto plano en el log de Postgres. | `start.sh` manda el verificador SCRAM. | Arreglado (en producción: `\password game_worker`). |
| 30 | El token de R2 de la web tiene que poder escribir en el bucket de juegos para borrar cuentas. | Mover ese borrado al worker. | Pendiente. |
| 31 | `.env` y `.env.supabase` legibles por cualquier usuario de la máquina. | `start.sh` los deja en 600. | Arreglado (las carpetas del home en 0777 son del sistema del usuario). |
| 32 | Cadena de suministro: `shadcn` en producción, `pnpm install` sin lockfile fijo en desarrollo, sin espera para versiones nuevas, worker sin hashes, checksum del CLI bajado del mismo release, `.env` de subcarpetas en el contexto de Docker. | `shadcn` en dev; `--frozen-lockfile`; `minimumReleaseAge` 7 días, `blockExoticSubdeps` y `trustPolicy: no-downgrade` (con una excepción revisada para `eslint-import-resolver-typescript@3.10.1`); `worker/requirements.lock` con hashes y `--require-hashes`; checksums del CLI fijados en `start.sh`; `**/.env*` en `.dockerignore`. | Arreglado. |
| 33 | Un juego podía mandar su marco a otro sitio con la pantalla completa y el teclado bloqueados (una ventana falsa). | La CSP del sitio (`frame-src`) solo deja que el marco muestre el dominio de juegos. | Mitigado. |
| 34 | Las portadas conservaban los metadatos (GPS). | Se quitan, como en los avances. | Arreglado. |
| 35 | Un JPEG con datos pegados después de su fin se aceptaba si terminaba en `FF D9`. | Se recorre el archivo hasta su fin real (`jpegEnd`). | Arreglado. `image-sniff.test.ts`. |
| 36 | Un ejecutable o un comprimido metido adentro de un `.gz` pasaba la revisión. | El worker mira lo que hay adentro de cada `.gz`; un `.gz` que no es gzip se rechaza. | Arreglado (los `.br` siguen sin revisarse por dentro: Python no trae decodificador). |
| 37 | `/api/posts` leía hasta 81 MB de cuerpo antes de comprobar la sesión. | Primero la sesión. | Arreglado. |
| 38 | El marco del juego permite `alert`/`prompt` y su propia pantalla completa. | Lo necesitan motores reales. | Aceptado. |
| 39 | El servidor de juegos decidía con el tipo de un pedido y servía con el de otro. | Decide y sirve con el mismo. | Arreglado. |
| 40 | Un cuadro de un GIF podía ser más grande que la imagen declarada (el navegador decodifica de más). | Cada cuadro tiene que entrar en la imagen. | Arreglado. |
| 41 | El error de un reclamo se registraba entero (con nombre y email). | Solo código y mensaje. | Arreglado. |

### Información (sin riesgo hoy, anotado para después)

- **Worker:**
  - `worker.complete_version` no comprueba `locked_by`: con dos workers, los dos podrían publicar la misma versión.
  - Las carpetas temporales de un trabajo cortado de golpe no se limpian al arrancar.
- **Servidor de juegos:** la caché vacía todo al llegar a 2000 entradas; pedidos a hosts al azar la renuevan una y otra vez.
- **Reportes:** reportar un comentario publicado de un juego que volvió a borrador muestra su texto en la copia del reporte.
- **Admins:** un admin puede cambiar el estado de su propio juego sin que quede en el registro de moderación.
- **React:** subir `react`/`react-dom` a 19.3.1. El aviso de npm es de `react-server-dom-*`, que Next ya trae corregido.
- **Dominio de medios:** conviene que no sea un subdominio del sitio (o exigir `CSP: sandbox` en él).

## Lo que se revisó y está bien

- **RLS:** está en las 22 tablas, sin permisos de escritura a nivel tabla ni para `PUBLIC`.
- **Columnas protegidas:** nadie cambia `owner_id`, `public_id`, contadores, roles ni estados (salvo borrador ⇄ publicado).
- **Funciones `SECURITY DEFINER`:** todas con `search_path` fijo; las de admin pasan por `require_admin`.
- **Rol `game_worker`:** solo puede ejecutar sus cuatro funciones.
- **Almacenamiento:** las claves de S3 las arma el servidor y la base valida cada ruta. La URL de subida fija clave, tipo y tamaño. No hay `service_role` en ningún lado.
- **Server Actions y Route Handlers:** todos comprueban la sesión. `/api/posts` exige `Origin`. Las Server Actions tienen la comprobación de origen de Next, sin `allowedOrigins`.
- **XSS:** no hay HTML del usuario. El JSON-LD se escapa, las tarjetas sociales son solo texto y los mails solo usan `SiteURL` y `TokenHash`.
- **SQL:** sin SQL dinámico con datos del usuario. La búsqueda limpia el texto antes de `to_tsquery`.
- **Validador de zips:** directorio central contra encabezados locales, ZIP64, bombas, rutas peligrosas, enlaces simbólicos, cifrado, duplicados por mayúsculas o forma Unicode, y extracción que no puede salirse de su carpeta.
- **Servidor de juegos:**
  - el id del juego sale del `Host` validado;
  - no hay salto de carpeta con `%2e%2e`;
  - nada de service workers;
  - CSP propia y cabeceras en cada respuesta;
  - los juegos ocultos responden 410.
- **Puente del reproductor:** controla origen y ventana en los dos sentidos.
- **Sin SSRF:** el servidor no pide direcciones que elija el usuario.
- **Errores:** no se muestran detalles técnicos. Los 31 `console.error` no registran tokens.
- **Imágenes de producción:** gateway y worker sin root, sistema de archivos de solo lectura y `cap_drop ALL`; la web de producción corre con uid 1001.

## Pasos de producción

1. **Supabase → Authentication:**
   - Activar el captcha (Attack Protection → Turnstile) con la misma clave secreta que la web.
   - Activar *Secure password change*.
   - Poner *Email OTP length* en 10.
   - Si el plan lo permite, activar *Leaked password protection*.
2. **Clave de los reclamos:**
   - Generar `CLAIMS_SERVER_KEY` (`openssl rand -hex 32`) y cargarla en el servidor de la web.
   - En el SQL Editor, cargar su SHA-256: `insert into private.server_keys (name, key_sha256) values ('claims', '<sha256>')`. El hash se calcula en tu máquina: `printf %s "$CLAIMS_SERVER_KEY" | sha256sum`.
3. **Cloudflare R2:**
   - Crear el bucket privado `S3_BUCKET_MEDIA_HIDDEN`. El token de la web necesita leer, escribir y borrar en él.
   - Al ocultar algo, purgar en Cloudflare la caché de esas direcciones: los medios se sirven con caché de un año.
4. **Worker:** `WORKER_DATABASE_URL` con `sslmode=verify-full&sslrootcert=…` (el certificado está en Supabase → Database → SSL) y la contraseña puesta con `\password game_worker`.
5. **Cloudflare:** una regla de límite de pedidos para los POST de `/login` y `/forgot-password`.
6. **Dominio:** `SITE_URL` con https. Con eso solos se activan la cookie `Secure`, HSTS y `upgrade-insecure-requests`.

## Entorno local: puertos de Supabase

El CLI de Supabase publica 54321–54324 (API, Postgres, Studio, Mailpit) en todas las interfaces y no tiene opción para limitarlo. Para que no se vean desde la red, una regla que corre cada uno en su máquina (cambiá `wlan0` por tu interfaz, `ip -br link`):

```
sudo iptables -I DOCKER-USER -i wlan0 -p tcp -m conntrack --ctorigdstport 54321:54324 --ctdir ORIGINAL -j DROP
```

No uses `"ip": "127.0.0.1"` en `daemon.json`: la web llega a Storage por `host.docker.internal:54321` y dejaría de funcionar.

## Cómo repetir la revisión

```
./pnpm audit --prod
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/repo:ro zricethezav/gitleaks:v8.24.3 git /repo --redact
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/src:ro -w /src semgrep/semgrep:1.140.0 semgrep scan --metrics=off \
  --config p/owasp-top-ten --config p/typescript --config p/react --config p/nextjs --config p/python --config p/docker --config p/secrets \
  --exclude node_modules --exclude .next --exclude .pnpm-store --exclude v4 --exclude juegos
```
