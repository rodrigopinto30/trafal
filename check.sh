#!/usr/bin/env bash
# Todas las verificaciones con un solo comando. Necesita ./start.sh corriendo (para los tests de la base de datos).
#   ./check.sh          lint + tipos + tests unitarios + tests de la base de datos (permisos/RLS)
#   ./check.sh --e2e    además, las pruebas de punta a punta (Playwright, ~2 min)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ -t 1 ]; then CYAN=$'\033[36m'; GREEN=$'\033[32m'; RESET=$'\033[0m'; else CYAN=""; GREEN=""; RESET=""; fi
step() { printf '\n%s▸ %s%s\n' "$CYAN" "$1" "$RESET"; }

.tools/supabase status --agent no >/dev/null 2>&1 || { echo "Supabase no está corriendo: levantalo con ./start.sh" >&2; exit 1; }

step "Lint (ESLint)";                       ./pnpm lint
step "Tipos (TypeScript estricto)";         ./pnpm typecheck
step "Tests unitarios (Vitest)";            ./pnpm test
step "Tests de la base de datos (pgTAP: RLS y permisos)"; .tools/supabase test db --agent no
step "Los tipos de la base están al día";   tools/db-types.sh --check
if [ "${1:-}" = "--e2e" ]; then
  step "Pruebas de punta a punta (Playwright)"; ./e2e/run.sh
fi
printf '\n%s✔ Todo en orden%s\n' "$GREEN" "$RESET"
