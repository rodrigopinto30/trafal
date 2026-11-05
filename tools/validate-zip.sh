#!/usr/bin/env bash
# Valida un zip de juego con las reglas de subida, sin tocar nada más. Imprime el resultado como JSON.
#   tools/validate-zip.sh ruta/al/juego.zip
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ $# -eq 1 ] && [ -f "$1" ] || { echo "Uso: tools/validate-zip.sh <archivo.zip>" >&2; exit 2; }

docker build -q -f docker/worker.Dockerfile --target test -t trafal-worker:test . >/dev/null
docker run --rm --user "$(id -u):$(id -g)" --network none --read-only --tmpfs /tmp \
  -v "$PWD/worker/src:/app/worker/src:ro" -v "$PWD/packages:/app/packages:ro" \
  -v "$(realpath "$1"):/input/game.zip:ro" -e PYTHONPATH=/app/worker/src \
  trafal-worker:test python -m trafal_worker.cli /input/game.zip
