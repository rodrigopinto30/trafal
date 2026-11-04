#!/usr/bin/env bash
# Trafal · baja todo el entorno local.
#
#   ./stop.sh            apaga los contenedores; conserva la base de datos y tus datos
#   ./stop.sh --purge    además BORRA la base de datos y los volúmenes (empezar de cero)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PURGE=0
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=1 ;;
    -h | --help) sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opción desconocida: $arg (probá ./stop.sh --help)" >&2; exit 1 ;;
  esac
done

if [ -t 1 ]; then CYAN=$'\033[36m'; GREEN=$'\033[32m'; RESET=$'\033[0m'; else CYAN=""; GREEN=""; RESET=""; fi
step() { printf '%s▸ %s%s\n' "$CYAN" "$1" "$RESET"; }

command -v docker >/dev/null 2>&1 || { echo "No encontré Docker." >&2; exit 1; }

ENV_FILES=()
[ -f .env ] && ENV_FILES+=(--env-file .env)
[ -f .env.supabase ] && ENV_FILES+=(--env-file .env.supabase)

step "Bajando la web"
DOWN_ARGS=(down --remove-orphans)
[ "$PURGE" = "1" ] && DOWN_ARGS+=(--volumes)
# La red de Supabase tiene que existir para que compose pueda resolver el archivo; si no existe, no hay nada que bajar.
docker compose "${ENV_FILES[@]}" -f docker-compose.yml "${DOWN_ARGS[@]}" 2>/dev/null || true
docker compose "${ENV_FILES[@]}" -f docker-compose.yml -f docker-compose.prod.yml "${DOWN_ARGS[@]}" 2>/dev/null || true

if [ -x .tools/supabase ]; then
  step "Bajando Supabase"
  STOP_ARGS=(stop --agent no)
  [ "$PURGE" = "1" ] && STOP_ARGS+=(--no-backup)
  .tools/supabase "${STOP_ARGS[@]}" || true
fi

if [ "$PURGE" = "1" ]; then
  rm -f .env.supabase
  printf '%s✔ Todo apagado y datos borrados.%s La próxima vez que corras ./start.sh arranca de cero.\n' "$GREEN" "$RESET"
else
  printf '%s✔ Todo apagado.%s Tus datos quedaron guardados; ./start.sh los recupera.\n' "$GREEN" "$RESET"
fi
