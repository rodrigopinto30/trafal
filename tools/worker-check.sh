#!/usr/bin/env bash
# Verifica el worker de Python dentro de Docker: ruff (estilo), mypy estricto y pytest.
#   tools/worker-check.sh            todo
#   tools/worker-check.sh pytest -k symlink    solo pytest, con los argumentos que pases
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

docker build -q -f docker/worker.Dockerfile --target test -t trafal-worker:test . >/dev/null

run() {
  docker run --rm --user "$(id -u):$(id -g)" --network none \
    -e RUFF_CACHE_DIR=/tmp/ruff -e MYPY_CACHE_DIR=/tmp/mypy \
    -v "$PWD/worker:/app/worker" -v "$PWD/packages:/app/packages:ro" \
    trafal-worker:test "$@"
}

if [ "${1:-}" = "pytest" ]; then shift; run python -m pytest "$@"; exit; fi

run ruff check .
run ruff format --check .
run mypy src tests
run python -m pytest -q
