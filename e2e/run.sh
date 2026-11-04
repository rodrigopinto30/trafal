#!/usr/bin/env bash
# Corre las pruebas e2e (Playwright) dentro de su imagen oficial, contra el entorno que levanta ./start.sh.
#   ./e2e/run.sh                      todas, en escritorio y en celular de 360 px
#   ./e2e/run.sh --project=mobile-360 solo en celular
#   ./e2e/run.sh -g "accesibilidad"   solo las que coinciden con ese nombre
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

PLAYWRIGHT_VERSION="1.64.1"
curl -fsS -o /dev/null http://localhost:3000/ || { echo "La web no responde en http://localhost:3000. Levantala con ./start.sh" >&2; exit 1; }

# Al terminar (pase o falle) se borran las cuentas «e2e_*» y los mails de prueba que crearon los tests.
cleanup() {
  if [ -x .tools/supabase ]; then
    .tools/supabase db query --agent no "delete from auth.users where email like 'e2e\_%@trafal.test'" >/dev/null 2>&1 || true
  fi
  curl -fsS -X DELETE http://localhost:54324/api/v1/messages >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --rm --network host --ipc=host -u "$(id -u):$(id -g)" \
  -e HOME=/tmp/home -e CI=true \
  -v "$PWD":/app -w /app/e2e \
  "mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble" \
  sh -c 'mkdir -p "$HOME" && ./node_modules/.bin/playwright test "$@"' -- "$@"
