-- Helpers de la suite de tests de base de datos (pgTAP).
--
-- Este archivo NO abre una transacción a propósito: los helpers del esquema `tests` quedan
-- guardados y los usan los archivos siguientes (se ejecutan en orden alfabético).
-- Viven solo en la base LOCAL; `supabase db reset` los borra y nunca viajan a producción.

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Crea un usuario en auth.users como lo haría GoTrue (sin perfil todavía).
create or replace function tests.create_user(p_email text, p_id uuid default gen_random_uuid())
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  );
  return p_id;
end;
$$;

-- Crea usuario + perfil + datos privados (equivale a haber hecho el onboarding).
create or replace function tests.create_profile(p_id uuid, p_username text, p_role text default 'user')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tests.create_user(p_username || '@trafal.test', p_id);
  insert into public.profiles (id, username, display_name)
  values (p_id, p_username, initcap(p_username));
  insert into public.profile_private (id, role, terms_version, terms_accepted_at, age_confirmed_at)
  values (p_id, p_role, '2026-11', now(), now());
  return p_id;
end;
$$;

-- A partir de acá las consultas corren como esa persona (rol `authenticated` + JWT con su id).
create or replace function tests.authenticate_as(p_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end;
$$;

-- Visitante sin sesión (rol `anon`).
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
end;
$$;

-- Vuelve a ser el superusuario de la conexión (para preparar datos o inspeccionar).
create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;

-- Ejecuta un INSERT/UPDATE/DELETE con los permisos actuales y devuelve cuántas filas tocó.
-- Con RLS, tocar filas ajenas NO da error: simplemente afecta 0 filas.
create or replace function tests.dml_count(p_sql text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Vacía todos los datos de la aplicación (cuentas, perfiles, juegos, avances...). Los tests la llaman dentro de su
-- propia transacción, que se revierte al terminar: así no dependen de los datos de desarrollo del seed y el seed no se toca.
create or replace function tests.wipe_app_data()
returns void
language sql
as $$
  delete from auth.users;   -- las claves foráneas en cascada se llevan perfiles, juegos, avances, comentarios, etc.
$$;

select plan(1);
select pass('helpers de tests cargados');
select * from finish();
