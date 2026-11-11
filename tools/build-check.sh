#!/usr/bin/env bash
# Comprueba que la web COMPILA para producción (`next build`), en una imagen aparte: no toca el servidor de desarrollo ni su carpeta
# .next. El servidor de desarrollo no ve algunos errores que el build sí rechaza (por ejemplo, leer la hora o los parámetros antes
# de un acceso dinámico en una página con Cache Components). Necesita ./start.sh corriendo (usa las claves públicas de Supabase).
#   tools/build-check.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

[ -f .env.supabase ] || { echo "Falta .env.supabase: levantá todo con ./start.sh" >&2; exit 1; }
set -a; . ./.env.supabase; set +a

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT
if docker build --progress=plain -f docker/web.Dockerfile --target prod -t trafal-web:build-check \
  --build-arg "NEXT_PUBLIC_SITE_URL=http://localhost:3000" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_PUBLIC_URL}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}" \
  --build-arg "NEXT_PUBLIC_MEDIA_URL=${MEDIA_PUBLIC_URL}" \
  --build-arg "NEXT_PUBLIC_GAMES_BASE_URL=${GAMES_BASE_URL}" . >"$LOG" 2>&1; then
  echo "  la web compila para producción"
else
  grep -v '^#[0-9]* \(DONE\|CACHED\)' "$LOG" | grep -E -B2 -A14 'Error|error' | head -60 >&2
  echo "✗ la web no compila para producción: arreglá el error de arriba." >&2
  exit 1
fi
