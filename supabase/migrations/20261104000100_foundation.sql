-- Trafal · 01 · Fundación
-- Extensiones, esquema `private` y política de privilegios "deny-by-default".
--
-- Principios que sigue TODO el esquema (y que verifican los tests pgTAP):
--   1. Toda tabla de `public` tiene RLS activado.
--   2. anon/authenticated no tienen ningún privilegio por defecto: cada tabla otorga solo lo que
--      necesita, y los UPDATE/INSERT se limitan por COLUMNA (el usuario nunca puede tocar roles,
--      contadores, estados de moderación, etc.).
--   3. Las funciones SECURITY DEFINER fijan `search_path = ''` y califican todo con su esquema.
--   4. Los helpers que usan las policies viven en `private`, que la API no expone como RPC.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Lo que se cree de acá en adelante NO es accesible por anon/authenticated hasta que una
-- migración haga un GRANT explícito.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------------------------
-- Helpers genéricos
-- ---------------------------------------------------------------------------------------------

create function private.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Identificador público y corto de un juego. Se usa como subdominio ({public_id}.GAMES_DOMAIN),
-- así que solo tiene minúsculas y dígitos, sin símbolos ambiguos (0/o, 1/l/i).
create function private.gen_public_id() returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea := extensions.gen_random_bytes(12);
  result text := '';
begin
  for i in 0..11 loop
    result := result || substr(alphabet, 1 + (get_byte(bytes, i) % 31), 1);
  end loop;
  return result;
end;
$$;

revoke all on function private.gen_public_id() from public;
grant execute on function private.gen_public_id() to authenticated;

-- Contador genérico: suma `delta` a `column` de la fila `id` de `schema.table`.
-- Los argumentos vienen de la definición del trigger (estáticos), nunca de datos del usuario.
create function private.bump_counter(p_schema text, p_table text, p_column text, p_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute format(
    'update %I.%I set %I = greatest(%I + $1, 0) where id = $2',
    p_schema, p_table, p_column, p_column
  ) using p_delta, p_id;
end;
$$;

revoke all on function private.bump_counter(text, text, text, uuid, integer) from public;
