#!/usr/bin/env bash
# Mide Lighthouse (rendimiento, accesibilidad, buenas prácticas y SEO) contra la versión de PRODUCCIÓN de la web, no contra el
# servidor de desarrollo (donde los números no significan nada). Necesita ./start.sh corriendo (Supabase con los datos de ejemplo).
#   tools/lighthouse.sh                  las páginas principales, en celular (la medición exigente) y en escritorio
#   tools/lighthouse.sh --pages "/ /explore"   solo esas
#   tools/lighthouse.sh --runs 5         veces que se mide cada página (se toma la mediana; por defecto 3)
#   tools/lighthouse.sh --mobile         solo en celular (más rápido)
#   tools/lighthouse.sh --keep           no baja la web de producción al terminar (queda en :3100)
# Falla (código 1) si el RENDIMIENTO en celular de una página «exigida» queda por debajo de MIN_PERFORMANCE (por defecto 85). Las
# exigidas son las del criterio de la fase (la portada y la página de un juego, GATED); las demás se miden y se informan.
# La web se compila con una dirección «pública» de mentira (trafal.example, que Chrome resuelve a 127.0.0.1): así robots.txt, las
# canónicas y el resto del SEO se miden como en un sitio real y no como en localhost, que se cierra por completo a los buscadores.
# Los informes completos quedan en lighthouse-reports/ (no se versionan).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

PAGES="/ /explore /creators /feed /games/orbita /u/sofi_pixels"
GATED="${GATED:-/ /games/orbita}"
RUNS=3
KEEP=0
FORM_FACTORS="mobile desktop"
PORT=3100
SITE_HOST=trafal.example
NAME=trafal-web-lighthouse
MIN_PERFORMANCE="${MIN_PERFORMANCE:-85}"
while [ $# -gt 0 ]; do
  case "$1" in
    --pages) PAGES="${2:?Falta la lista de páginas}"; shift 2 ;;
    --runs) RUNS="${2:?Falta la cantidad}"; shift 2 ;;
    --mobile) FORM_FACTORS="mobile"; shift ;;
    --keep) KEEP=1; shift ;;
    *) echo "Argumento desconocido: $1" >&2; exit 2 ;;
  esac
done

[ -f .env.supabase ] || { echo "Falta .env.supabase: levantá todo con ./start.sh" >&2; exit 1; }
set -a; . ./.env.supabase; set +a
docker ps --format '{{.Names}}' | grep -qx supabase_db_trafal || { echo "Supabase no está corriendo: ./start.sh" >&2; exit 1; }

cleanup() { [ "$KEEP" = 1 ] || docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▸ Compilando la web de producción (puede tardar unos minutos la primera vez)…"
docker build -q -f docker/web.Dockerfile --target prod -t trafal-web:lighthouse \
  --build-arg "NEXT_PUBLIC_SITE_URL=http://${SITE_HOST}:${PORT}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_PUBLIC_URL}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}" \
  --build-arg "NEXT_PUBLIC_MEDIA_URL=${MEDIA_PUBLIC_URL}" \
  --build-arg "NEXT_PUBLIC_GAMES_BASE_URL=${GAMES_BASE_URL}" . >/dev/null

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --network supabase_network_trafal --add-host host.docker.internal:host-gateway \
  -p "127.0.0.1:${PORT}:3000" \
  -e SUPABASE_INTERNAL_URL=http://supabase_kong_trafal:8000 \
  -e S3_ENDPOINT -e S3_REGION -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY -e S3_PUBLIC_ENDPOINT \
  -e "S3_BUCKET_MEDIA=${S3_BUCKET_MEDIA:-media}" -e "S3_BUCKET_QUARANTINE=${S3_BUCKET_QUARANTINE:-quarantine}" \
  trafal-web:lighthouse >/dev/null
for _ in $(seq 1 60); do curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/" 2>/dev/null && break; sleep 2; done
curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/" || { echo "La web de producción no arrancó:" >&2; docker logs "$NAME" 2>&1 | tail -20 >&2; exit 1; }
for page in $PAGES; do curl -fsS -o /dev/null "http://127.0.0.1:${PORT}${page}" || { echo "No responde ${page}" >&2; exit 1; }; done

mkdir -p lighthouse-reports .tools/lighthouse
echo "▸ Midiendo con Lighthouse (${RUNS} veces cada página, mediana)…"
docker run --rm --network host --ipc=host -u "$(id -u):$(id -g)" \
  -e HOME=/tmp/home -e "PAGES=${PAGES}" -e "RUNS=${RUNS}" -e "PORT=${PORT}" -e "SITE_HOST=${SITE_HOST}" -e "FORM_FACTORS=${FORM_FACTORS}" -e "MIN_PERFORMANCE=${MIN_PERFORMANCE}" -e "GATED=${GATED}" \
  -v "$PWD":/app -v "$PWD/.tools/lighthouse":/tmp/lighthouse -w /app/e2e \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  sh -c 'mkdir -p "$HOME" && cd /tmp/lighthouse && ( [ -d node_modules/lighthouse ] || (npm init -y >/dev/null && npm i --silent lighthouse@12 chrome-launcher@1) ) && cd /app/e2e && NODE_PATH=/tmp/lighthouse/node_modules node /app/tools/lighthouse-run.mjs'
