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
  if [ -x .tools/supabase ] && docker ps --format '{{.Names}}' | grep -qx supabase_db_trafal; then
    # Files the tests uploaded (game zips in quarantine, covers, screenshots, update files and published game files): they are not
    # deleted with the account. Only objects that actually exist are listed (removing a missing one aborts the whole command),
    # and the published files go by folder, one per game. Never `rm -r` on a bucket itself: it would delete the bucket.
    docker exec supabase_db_trafal psql -U postgres -At -c "
      with mine as (
        select g.id, g.public_id, g.cover_path from public.games g join auth.users u on u.id = g.owner_id
        where u.email like 'e2e\_%@trafal.test'
      )
      select 'ss:///quarantine/' || o.name from storage.objects o
        where o.bucket_id = 'quarantine' and split_part(o.name, '/', 1)::text in (select id::text from mine)
      union all
      select 'ss:///media/' || o.name from storage.objects o
        where o.bucket_id = 'media'
          and ((o.name in (select cover_path from mine where cover_path is not null)
                or split_part(o.name, '/', 2) in (select id::text from mine))
               and split_part(o.name, '/', 1) in ('covers', 'screenshots')
               or split_part(o.name, '/', 1) = 'posts'
               and split_part(o.name, '/', 2) in (
                 select p.id::text from public.posts p join auth.users u on u.id = p.author_id where u.email like 'e2e\_%@trafal.test'))" 2>/dev/null | xargs -r .tools/supabase --experimental --yes storage rm >/dev/null 2>&1 || true
    docker exec supabase_db_trafal psql -U postgres -At -c "
      select distinct 'ss:///games/' || split_part(o.name, '/', 1) from storage.objects o
        where o.bucket_id = 'games'
          and split_part(o.name, '/', 1) in (
            select g.public_id from public.games g join auth.users u on u.id = g.owner_id where u.email like 'e2e\_%@trafal.test')" 2>/dev/null | xargs -r .tools/supabase --experimental --yes storage rm -r >/dev/null 2>&1 || true
  fi
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
