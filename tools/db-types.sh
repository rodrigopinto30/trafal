#!/usr/bin/env bash
# Regenera los tipos de TypeScript de la base de datos a partir del esquema real (Supabase local tiene que estar corriendo).
#   tools/db-types.sh           escribe apps/web/src/lib/supabase/database.types.ts
#   tools/db-types.sh --check   falla si el archivo versionado no coincide con el esquema (lo usa ./check.sh)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
TARGET="apps/web/src/lib/supabase/database.types.ts"
GENERATED="$(.tools/supabase gen types typescript --local --agent no 2>/dev/null)"
if [ "${1:-}" = "--check" ]; then
  if [ "$GENERATED" = "$(cat "$TARGET")" ]; then echo "  los tipos de la base de datos están al día"; exit 0; fi
  echo "✗ $TARGET no coincide con el esquema: corré tools/db-types.sh y commiteá el cambio." >&2
  exit 1
fi
printf '%s\n' "$GENERATED" > "$TARGET"
echo "✔ escribí $TARGET"
