#!/usr/bin/env bash
# Elige, mira o saca el primer juego de la semana. Entra como admin (la función lo exige y deja rastro en el registro de moderación).
#   tools/featured-game.sh show
#   tools/featured-game.sh set <public_id> [--week AAAA-MM-DD] [--quote "texto"]
#   tools/featured-game.sh clear [--week AAAA-MM-DD]
# Variables: ADMIN_EMAIL y ADMIN_PASSWORD (si faltan se piden), y para otro entorno que no sea el local, SUPABASE_URL y
# SUPABASE_PUBLISHABLE_KEY (en local salen de .env.supabase).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

command -v curl >/dev/null && command -v python3 >/dev/null || { echo "Hacen falta curl y python3." >&2; exit 2; }
[ -f .env.supabase ] && { set -a; . ./.env.supabase; set +a; }
URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
KEY="${SUPABASE_PUBLISHABLE_KEY:?Falta SUPABASE_PUBLISHABLE_KEY}"

json() { python3 -c "import json,sys; print(json.dumps(dict(zip(sys.argv[1::2], [None if v == '' else v for v in sys.argv[2::2]]))))" "$@"; }
rest() { curl -fsS -H "apikey: $KEY" -H "Content-Type: application/json" "$@"; }

action="${1:-}"; shift || true
week=""; quote=""; game=""
if [ "$action" = "set" ]; then game="${1:?Falta el id público del juego}"; shift; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --week) week="${2:?Falta la fecha}"; shift 2 ;;
    --quote) quote="${2:?Falta el texto}"; shift 2 ;;
    *) echo "Argumento desconocido: $1" >&2; exit 2 ;;
  esac
done

if [ "$action" = "show" ]; then
  rest "$URL/rest/v1/featured_games?select=week_start,quote,game:games(public_id,title)&order=week_start.desc&limit=8" | python3 -m json.tool
  exit 0
fi
[ "$action" = "set" ] || [ "$action" = "clear" ] || { sed -n 2,7p "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

email="${ADMIN_EMAIL:-}"; password="${ADMIN_PASSWORD:-}"
[ -n "$email" ] || read -r -p "Email de admin: " email
[ -n "$password" ] || { read -r -s -p "Contraseña: " password; echo; }
login="$(rest -X POST "$URL/auth/v1/token?grant_type=password" -d "$(json email "$email" password "$password")" 2>/dev/null)" || { echo "No se pudo iniciar sesión: revisá el email y la contraseña." >&2; exit 1; }
token="$(printf '%s' "$login" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")"


if [ "$action" = "set" ]; then
  id="$(rest "$URL/rest/v1/games?public_id=eq.$game&status=eq.published&select=id" | python3 -c "import json,sys; rows=json.load(sys.stdin); print(rows[0]['id'] if rows else '')")"
  [ -n "$id" ] || { echo "No hay un juego publicado con el id «$game»." >&2; exit 1; }
  result="$(curl -sS -X POST "$URL/rest/v1/rpc/set_featured_game" -H "apikey: $KEY" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$(json p_game_id "$id" p_week_start "$week" p_quote "$quote")")"
else
  result="$(curl -sS -X POST "$URL/rest/v1/rpc/clear_featured_game" -H "apikey: $KEY" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$(json p_week_start "$week")")"
fi
echo "$result"
case "$result" in *'"message"'*) exit 1 ;; esac
