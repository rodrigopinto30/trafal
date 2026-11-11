#!/usr/bin/env bash
# Comprueba las cabeceras con que se sirve un archivo del dominio público de medios (imágenes y videos de la gente).
#   tools/check-media-headers.sh https://media.tu-dominio.com/avatars/<id>/<archivo>.webp   producción
#   tools/check-media-headers.sh                                                            local: toma una foto de la base
# Exige X-Content-Type-Options: nosniff y un Content-Type de imagen o video; avisa si falta la CSP con «sandbox».
# En local (Supabase Storage) falta nosniff: es esperable, solo importa en producción (docs/DESARROLLO.md → «Medios en producción»).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

url="${1:-}"
if [ -z "$url" ]; then
  object=$(docker exec supabase_db_trafal psql -U postgres -At -c "select name from storage.objects where bucket_id = 'media' order by created_at desc limit 1" 2>/dev/null || true)
  [ -n "$object" ] || { echo "Pasá la dirección de un archivo subido, o levantá el entorno local con ./start.sh y subí una foto." >&2; exit 2; }
  url="http://127.0.0.1:54321/storage/v1/object/public/media/$object"
fi

headers=$(curl -sS -I -m 20 "$url") || { echo "No se pudo pedir $url" >&2; exit 2; }
header() { printf '%s\n' "$headers" | tr -d '\r' | grep -i "^$1:" | head -1 | cut -d: -f2- | sed 's/^ *//' || true; }

status=$(printf '%s\n' "$headers" | head -1 | tr -d '\r' | awk '{print $2}')
nosniff=$(header x-content-type-options)
type=$(header content-type)
csp=$(header content-security-policy)
failed=0

echo "Archivo: $url"
if [ "$status" = "200" ]; then echo "  ✔ responde 200"; else echo "  ✘ responde $status (se esperaba 200)"; failed=1; fi
if [ "$(printf '%s' "$nosniff" | tr 'A-Z' 'a-z')" = "nosniff" ]; then echo "  ✔ X-Content-Type-Options: nosniff"; else echo "  ✘ falta X-Content-Type-Options: nosniff (regla de transformación de Cloudflare)"; failed=1; fi
case "$type" in image/*|video/*) echo "  ✔ Content-Type: $type" ;; *) echo "  ✘ Content-Type inesperado: «${type:-ninguno}»"; failed=1 ;; esac
case "$csp" in *sandbox*) echo "  ✔ Content-Security-Policy con sandbox" ;; *) echo "  ! recomendado: Content-Security-Policy: default-src 'none'; sandbox" ;; esac

[ "$failed" = 0 ] && echo "Todo en orden." || { echo "Hay cabeceras que arreglar." >&2; exit 1; }
