# Base de datos

Postgres (vía Supabase). El esquema completo del MVP está desde la Fase 1: **22 tablas, todas con RLS**. Se versiona en [`supabase/migrations`](../supabase/migrations) y sus permisos se prueban en [`supabase/tests/database`](../supabase/tests/database).

## Principios (los verifica `01-invariants.test.sql`)

1. **RLS activado en toda tabla de `public`.** Si alguien agrega una tabla sin RLS, el test falla.
2. **Deny-by-default.** `anon` y `authenticated` no reciben ningún privilegio por defecto; cada tabla otorga solo lo que necesita. `supabase/config.toml` además tiene `auto_expose_new_tables = false`.
3. **Escritura por columna, nunca por tabla.** Un `GRANT UPDATE` a nivel tabla permitiría tocar columnas protegidas (rol, contadores, estados de moderación, `is_helpful`, versión activa…). El test falla si aparece uno.
4. **`SECURITY DEFINER` solo con `search_path` fijo** y con todo calificado por esquema.
5. **Lo que usan las policies vive en `private`**, un esquema que la API no expone (`api.schemas = ["public"]`). Solo son RPC públicas `username_available` y `complete_onboarding`.
6. **Los admins no escriben tablas directamente**: leen por RLS y todo cambio de moderación pasará por funciones que dejan rastro en `moderation_log` (Fase 5). `moderation_log` es *append-only*: un trigger impide editarlo o borrarlo, incluso al superusuario.

## Tablas

| Tabla | Qué guarda | Quién escribe |
|---|---|---|
| `engines`, `genres` | Catálogos (ids estables; los nombres viven en i18n). 9 motores y 17 géneros | Solo migraciones |
| `profiles` | Perfil público: @usuario (inmutable en el MVP), nombre, bio, ciudad, país, motores, géneros favoritos, ruta de la foto, contadores | Alta: `complete_onboarding`. Edición: dueño, solo 7 columnas |
| `profile_private` | Rol, suspensión, términos aceptados, idioma | El dueño solo cambia `locale`; el resto, funciones (`suspend_account` y `lift_suspension` para la suspensión, con registro) |
| `follows` | Quién sigue a quién (grafo público) | Cada persona, solo sus filas |
| `games` | Ficha del juego, versión activa, estado, contadores, `search_doc` (texto de búsqueda) | Dueño (borrador ⇄ publicado); moderación: funciones |
| `game_screenshots`, `game_questions` | Capturas y hasta 3 preguntas de feedback | Dueño del juego |
| `game_versions` | Versiones subidas (estado, motor detectado, errores…) | Creación y estado: **solo funciones/worker** (Fase 2) |
| `posts`, `post_media` | Avances (4 tipos) y sus archivos | Autor |
| `comments` | Comentarios (un nivel de respuestas, etiquetas, «Me sirvió») | Autor edita texto/etiqueta solo mientras está publicado; «Me sirvió» solo por la función `set_comment_helpful` (dueño del juego o del avance) |
| `post_likes`, `game_likes`, `post_saves`, `game_saves` | Me gusta y guardados (privados; el público ve solo contadores) | Cada persona, solo los suyos |
| `plays` | Partidas (inicio, duración aproximada, dispositivo; sin IP) | Solo funciones (Fase 2) |
| `notifications` | Campanita | Solo triggers y las funciones de moderación (nadie inserta desde el cliente); el destinatario lee, marca como leídas (`read_at`) y descarta las suyas |
| `reports` | Reportes de contenido, con copia del contenido como evidencia | Cualquier cuenta activa inserta; admins leen y solo cambian el estado con `take_report` / `resolve_report` |
| `copyright_claims` | Reclamos de derechos de autor | Se crean solo con `submit_copyright_claim` (también para visitantes); los leen solo admins, que los manejan con `take_claim` / `resolve_claim` (con registro) |
| `featured_games` | Primer juego de la semana (solo «primeros juegos» publicados) | Solo las funciones de admin `set_featured_game` / `clear_featured_game`, que dejan rastro en `moderation_log` |
| `usage_events` | Cada acción limitada de cada persona (para contar los topes de uso) | Solo los triggers; nadie la lee ni la escribe desde el cliente (RLS sin policies ni permisos). Se limpia sola: al contar, se borra lo de más de 2 días |
| `moderation_log` | Registro de acciones de moderación (inmutable) | Funciones de moderación: `take_report`, `resolve_report`, `moderate_content`, `set_featured_game`, `clear_featured_game` |

Triggers destacados: contadores (seguidores, me gusta, guardados, comentarios), `search_doc` del juego (texto sin tildes con título, descripción, etiquetas, género, motor y creador, en español e inglés), reglas de comentarios (un nivel, mismo avance/juego), un solo «primer juego» por persona, un juego publicado exige versión activa lista.

**Reglas del perfil que vive la base** (la interfaz solo da feedback):

- **@usuario**: una sola función, `private.is_valid_username` (3–30 caracteres, `a-z 0-9 _ .`, el punto no va al principio, al final ni repetido, al menos una letra o número). La usan el CHECK `profiles_username_format`, `username_available` y `complete_onboarding`. `private.reserved_usernames()` lista los 22 nombres que permitirían hacerse pasar por el equipo.
- **Géneros y motores**: el trigger `profiles_before_write` descarta repetidos y NULL, ordena y valida contra los catálogos (`invalid_genre` / `invalid_engine`, errcode 22023).
- **Foto**: `avatar_path` es solo una ruta. El CHECK `profiles_avatar_path_fmt` exige `avatars/<tu id>/<32 hex>.webp|jpg|png`: nadie puede apuntar su foto a la carpeta de otra persona, a otra carpeta del almacenamiento, a una URL externa ni salirse con `..`.

Estados de un usuario: una cuenta **suspendida** (o sin onboarding) no puede escribir nada; la suspensión temporal vencida se levanta sola.

## Almacenamiento de objetos (imágenes)

Las imágenes **no** viven en Postgres: la base guarda solo la ruta. Los bytes van a un bucket S3 compatible: **Cloudflare R2** en producción y, en local, el endpoint S3 de **Supabase Storage** (`[storage]` en `supabase/config.toml`; `./start.sh` siembra el bucket).

| Bucket | Acceso | Qué guarda | Límites |
|---|---|---|---|
| `media` | Lectura pública; escritura solo con las credenciales S3 del **servidor** | `avatars/<id de la persona>/<32 hex>.webp\|jpg\|png` (hoy); capturas y avances (Fases 2–3) | Solo imagen/GIF/MP4/WebM (lista de tipos MIME del bucket), 20 MiB |

El navegador **nunca** recibe credenciales: la subida pasa por una Server Action que valida los bytes (`lib/media/image-sniff.ts`). Variables (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_MEDIA`, `MEDIA_PUBLIC_URL`): en local las genera `./start.sh`; en producción ver [`.env.example`](../.env.example). Esto **no** usa la `service_role` de Supabase: son las credenciales del almacenamiento (en producción, un token de R2 con permiso solo sobre ese bucket; para eliminar cuentas, además listar y borrar objetos en los buckets de cuarentena y de juegos).

**Eliminar una cuenta**: `delete_my_account()` borra el usuario de `auth.users` y las claves foráneas en cascada se llevan todo lo demás; `account_files()` devuelve antes las carpetas del almacenamiento que el servidor tiene que vaciar (los objetos no se borran desde SQL). Se conservan `moderation_log` y `copyright_claims` (sin cuenta). Ver «Eliminar la cuenta» en [DECISIONS.md](DECISIONS.md).

## Cómo cambiar el esquema

```bash
.tools/supabase migration new nombre_del_cambio     # crea supabase/migrations/<fecha>_nombre_del_cambio.sql
# …editá la migración NUEVA (no las ya aplicadas) — ¡con RLS y grants por columna para toda tabla nueva!…
./start.sh                                          # aplica las migraciones nuevas sobre tu base, sin perder datos
# …escribí el test pgTAP en supabase/tests/database/ (copiá el estilo de los existentes)…
tools/db-types.sh                                   # regenera apps/web/src/lib/supabase/database.types.ts
./check.sh                                          # todo en verde antes de seguir
./start.sh --reset                                  # (opcional) recrea la base desde cero: migraciones + seed
```

Los tests arrancan vaciando los datos dentro de su propia transacción (`tests.wipe_app_data()`), así que no dependen del seed y no lo modifican. Para explorar a mano: Supabase Studio en http://localhost:54323. `.tools/supabase db advisors` revisa seguridad y performance del esquema (hoy: *No issues found*).
