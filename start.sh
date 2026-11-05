#!/usr/bin/env bash
# Trafal · levanta TODO el entorno local con un solo comando.
#
#   ./start.sh            desarrollo (recarga en caliente)
#   ./start.sh --prod     la web compilada, como en producción
#   ./start.sh --reset    además, borra y recrea la base de datos desde las migraciones + seed
#   ./start.sh --build    fuerza reconstruir la imagen de la web
#
# Lo único que necesitás instalado es Docker (con Compose). Node, pnpm y el CLI de Supabase corren
# adentro de contenedores o se descargan acá, en ./.tools.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

SUPABASE_CLI_VERSION="3.0.0"
TOOLS_DIR=".tools"
SUPABASE_BIN="$TOOLS_DIR/supabase"

MODE="dev"
RESET_DB=0
FORCE_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --prod) MODE="prod" ;;
    --reset) RESET_DB=1 ;;
    --build) FORCE_BUILD=1 ;;
    -h | --help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opción desconocida: $arg (probá ./start.sh --help)" >&2; exit 1 ;;
  esac
done

if [ -t 1 ]; then BOLD=$'\033[1m'; DIM=$'\033[2m'; CYAN=$'\033[36m'; GREEN=$'\033[32m'; RED=$'\033[31m'; RESET=$'\033[0m'; else BOLD=""; DIM=""; CYAN=""; GREEN=""; RED=""; RESET=""; fi
step() { printf '%s▸ %s%s\n' "$CYAN" "$1" "$RESET"; }
fail() { printf '%s✗ %s%s\n' "$RED" "$1" "$RESET" >&2; exit 1; }

# ---------------------------------------------------------------------------------------------
step "Revisando Docker"
command -v docker >/dev/null 2>&1 || fail "No encontré Docker. Instalalo desde https://docs.docker.com/get-docker/ y volvé a probar."
docker info >/dev/null 2>&1 || fail "Docker está instalado pero no responde. ¿Está corriendo? (¿tu usuario está en el grupo «docker»?)"
docker compose version >/dev/null 2>&1 || fail "Falta Docker Compose v2 (el comando «docker compose»)."

# ---------------------------------------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  step "Creé .env a partir de .env.example (revisalo si querés cambiar puertos o activar Google)"
fi
# shellcheck disable=SC1091
set -a; . ./.env; set +a

# ---------------------------------------------------------------------------------------------
# CLI de Supabase: versión fija, descargada y verificada por checksum SHA-256.
install_supabase_cli() {
  local os arch asset base tmp expected actual
  case "$(uname -s)" in Linux) os="linux" ;; Darwin) os="darwin" ;; *) fail "Sistema no soportado para descargar el CLI de Supabase: $(uname -s)" ;; esac
  case "$(uname -m)" in x86_64 | amd64) arch="amd64" ;; arm64 | aarch64) arch="arm64" ;; *) fail "Arquitectura no soportada: $(uname -m)" ;; esac
  asset="supabase_${SUPABASE_CLI_VERSION}_${os}_${arch}.tar.gz"
  base="https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  step "Descargando el CLI de Supabase ${SUPABASE_CLI_VERSION} (${os}/${arch})"
  curl -fsSL -o "$tmp/$asset" "$base/$asset" || fail "No pude descargar $base/$asset"
  curl -fsSL -o "$tmp/checksums.txt" "$base/checksums.txt" || fail "No pude descargar los checksums"
  expected="$(grep " $asset\$" "$tmp/checksums.txt" | awk '{print $1}')"
  if command -v sha256sum >/dev/null 2>&1; then actual="$(sha256sum "$tmp/$asset" | awk '{print $1}')"; else actual="$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')"; fi
  [ -n "$expected" ] && [ "$expected" = "$actual" ] || fail "El checksum del CLI de Supabase no coincide: se descarta la descarga."
  mkdir -p "$TOOLS_DIR"
  tar -xzf "$tmp/$asset" -C "$TOOLS_DIR" supabase
  chmod +x "$SUPABASE_BIN"
}
if [ ! -x "$SUPABASE_BIN" ] || [ "$("$SUPABASE_BIN" --version 2>/dev/null || true)" != "$SUPABASE_CLI_VERSION" ]; then
  install_supabase_cli
fi
sb() { "$SUPABASE_BIN" "$@" --agent no; }

# El login con Google solo se activa si hay credenciales reales.
if [ -n "${SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID:-}" ] && [ -n "${SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET:-}" ]; then
  GOOGLE_AUTH_ENABLED="true"
else
  GOOGLE_AUTH_ENABLED="false"
  export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="disabled-placeholder"
  export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="disabled-placeholder"
fi
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET

# ---------------------------------------------------------------------------------------------
step "Levantando Supabase (base de datos, auth, tiempo real, correo de pruebas)"
if sb status >/dev/null 2>&1; then
  printf '%s  ya estaba corriendo%s\n' "$DIM" "$RESET"
else
  sb start
fi
if [ "$RESET_DB" = "1" ]; then
  step "Recreando la base de datos desde las migraciones + seed"
  sb db reset
else
  sb migration up >/dev/null 2>&1 || true   # aplica migraciones nuevas si las hay (es idempotente)
fi
# Buckets de almacenamiento declarados en supabase/config.toml (`db reset` ya los crea; esto cubre el arranque normal).
# --yes y stdin cerrado: si el bucket ya existe el CLI pregunta si actualizar sus propiedades y no debe quedarse esperando.
sb seed buckets --yes </dev/null >/dev/null 2>&1 || true

# Rol mínimo del worker de juegos (la migración lo crea sin login): se le pone una contraseña propia de esta máquina, que se
# conserva entre arranques y vive solo en .env.supabase (ignorado por git).
WORKER_DB_PASSWORD="$(grep '^WORKER_DB_PASSWORD=' .env.supabase 2>/dev/null | cut -d= -f2- || true)"
[ -n "$WORKER_DB_PASSWORD" ] || WORKER_DB_PASSWORD="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
sb db query "alter role game_worker with login password '$WORKER_DB_PASSWORD'" >/dev/null

# Claves y URLs de Supabase para la web (archivo generado, ignorado por git).
STATUS_ENV="$(sb status -o env 2>/dev/null)"
status_value() { printf '%s\n' "$STATUS_ENV" | grep "^$1=" | head -1 | cut -d'"' -f2; }
API_URL="$(status_value API_URL)"
API_PORT="${API_URL##*:}"
PUBLISHABLE_KEY="$(status_value PUBLISHABLE_KEY)"
[ -n "$PUBLISHABLE_KEY" ] || PUBLISHABLE_KEY="$(status_value ANON_KEY)"
[ -n "$API_URL" ] && [ -n "$PUBLISHABLE_KEY" ] || fail "No pude leer la URL/clave de Supabase («supabase status»)."
cat > .env.supabase <<EOF
# Generado por ./start.sh — no editar ni versionar.
SUPABASE_PUBLIC_URL=$API_URL
SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
GOOGLE_AUTH_ENABLED=$GOOGLE_AUTH_ENABLED
HOST_UID=$(id -u)
HOST_GID=$(id -g)
# Almacenamiento de imágenes: en local, el endpoint S3 de Supabase Storage hace de Cloudflare R2. El servidor entra por
# host.docker.internal:<puerto publicado> (y no por la red interna de Docker) porque Storage firma con ese puerto.
S3_ENDPOINT=http://host.docker.internal:${API_PORT}/storage/v1/s3
# Mismo almacenamiento, pero con la dirección que ve el NAVEGADOR: las URL firmadas de subida se firman con este host.
S3_PUBLIC_ENDPOINT=$API_URL/storage/v1/s3
S3_REGION=$(status_value S3_PROTOCOL_REGION)
S3_ACCESS_KEY_ID=$(status_value S3_PROTOCOL_ACCESS_KEY_ID)
S3_SECRET_ACCESS_KEY=$(status_value S3_PROTOCOL_ACCESS_KEY_SECRET)
MEDIA_PUBLIC_URL=$API_URL/storage/v1/object/public/media
# Worker de juegos: conexión directa a Postgres con el rol mínimo `game_worker`.
WORKER_DB_PASSWORD=$WORKER_DB_PASSWORD
WORKER_DATABASE_URL=postgresql://game_worker:$WORKER_DB_PASSWORD@supabase_db_trafal:5432/postgres
EOF

# ---------------------------------------------------------------------------------------------
COMPOSE=(docker compose --env-file .env --env-file .env.supabase -f docker-compose.yml)
[ "$MODE" = "prod" ] && COMPOSE+=(-f docker-compose.prod.yml)

step "Levantando la web (${MODE})"
UP_ARGS=(up -d --wait --wait-timeout 240 --build)
[ "$FORCE_BUILD" = "1" ] && "${COMPOSE[@]}" build --no-cache
"${COMPOSE[@]}" "${UP_ARGS[@]}" || { "${COMPOSE[@]}" logs --tail 60 web >&2 || true; fail "La web no terminó de arrancar (mirá los logs de arriba)."; }

SITE="${SITE_URL:-http://localhost:3000}"
printf '\n%s✔ Trafal está corriendo%s\n\n' "$GREEN" "$RESET"
printf '  %sWeb%s                %s\n' "$BOLD" "$RESET" "$SITE"
printf '  %sCorreo de pruebas%s  http://localhost:54324   %s(acá llegan los mails de confirmación)%s\n' "$BOLD" "$RESET" "$DIM" "$RESET"
printf '  %sSupabase Studio%s    http://localhost:54323\n' "$BOLD" "$RESET"
printf '  %sAPI de Supabase%s    %s\n\n' "$BOLD" "$RESET" "$API_URL"
printf '  %sCuentas de prueba%s  (contraseña: trafal123)\n' "$BOLD" "$RESET"
printf '    valen@trafal.test   → @valen_makes\n    mateo@trafal.test   → @mateo_g\n    admin@trafal.test   → @equipo_trafal (admin)\n\n'
printf '  Para bajar todo: %s./stop.sh%s\n' "$BOLD" "$RESET"
