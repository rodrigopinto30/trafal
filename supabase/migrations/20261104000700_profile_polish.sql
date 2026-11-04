-- Trafal · 07 · Pulido del perfil: @usuario más permisivo, géneros favoritos y foto de perfil
--
-- Es una migración NUEVA (no toca las anteriores): `./start.sh` la aplica sola sobre la base que ya tenías,
-- sin perder datos.

-- ---------------------------------------------------------------------------------------------
-- 1) @usuario
--    Antes: 3–20 caracteres, tenía que empezar y terminar con letra o número y no admitía "__" ni "_." .
--    Ahora: si el nombre está libre y es razonable, se puede usar. No se exigen números.
--      · 3 a 30 caracteres
--      · letras minúsculas (a–z), números, guion bajo y punto
--      · el punto no puede ir al principio, al final ni repetido (".."): "@rodri." se confunde con el final de una frase
--      · al menos una letra o un número (no vale "___")
--    La regla vive en UNA función que usan el CHECK de la tabla, username_available y complete_onboarding.
-- ---------------------------------------------------------------------------------------------

create function private.is_valid_username(p_username text) returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_username ~ '^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$'
    and p_username !~ '\.\.'
    and p_username ~ '[a-z0-9]',
    false
  );
$$;

revoke all on function private.is_valid_username(text) from public;
grant execute on function private.is_valid_username(text) to anon, authenticated;

alter table public.profiles drop constraint profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format check (private.is_valid_username(username));

-- Nombres reservados: solo los que permitirían hacerse pasar por el equipo o por el sistema. Los perfiles viven
-- bajo /u/<usuario>, así que ya no hace falta reservar palabras que coinciden con rutas del sitio (feed, games...).
create or replace function private.reserved_usernames() returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'admin', 'administrator', 'administrador', 'root', 'system', 'sistema', 'trafal', 'staff',
    'soporte', 'support', 'help', 'ayuda', 'moderator', 'moderador', 'mod', 'api', 'www', 'null',
    'undefined', 'anonymous', 'anonimo', 'me'
  ];
$$;

create or replace function public.username_available(p_username text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_valid_username(lower(btrim(p_username)))
     and not (lower(btrim(p_username)) = any (private.reserved_usernames()))
     and not exists (select 1 from public.profiles where username = lower(btrim(p_username)));
$$;

create or replace function public.complete_onboarding(
  p_username text,
  p_display_name text,
  p_terms_version text,
  p_accept_terms boolean,
  p_age_confirmed boolean,
  p_locale text default 'es'
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_name text := btrim(coalesce(p_display_name, ''));
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'already_onboarded';
  end if;
  -- «p_age_confirmed» es la declaración de tener 18 años o más (versión vigente de los términos).
  if not coalesce(p_age_confirmed, false) then
    raise exception 'age_confirmation_required';
  end if;
  if not coalesce(p_accept_terms, false) then
    raise exception 'terms_required';
  end if;
  if not private.is_valid_username(v_username) then
    raise exception 'invalid_username';
  end if;
  if v_username = any (private.reserved_usernames()) then
    raise exception 'reserved_username';
  end if;
  if char_length(v_name) not between 1 and 50 then
    raise exception 'invalid_display_name';
  end if;
  if coalesce(char_length(p_terms_version), 0) not between 1 and 32 then
    raise exception 'invalid_terms_version';
  end if;

  begin
    insert into public.profiles (id, username, display_name)
    values (v_uid, v_username, v_name)
    returning * into v_profile;
  exception when unique_violation then
    raise exception 'username_taken';
  end;

  insert into public.profile_private (id, locale, terms_version, terms_accepted_at, age_confirmed_at)
  values (v_uid, case when p_locale in ('es', 'en') then p_locale else 'es' end, p_terms_version, now(), now());

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2) Géneros favoritos del perfil (la grilla de «qué juegos me gustan»)
--    Reutiliza el catálogo `genres`, al que se suman géneros comunes en juegos web.
-- ---------------------------------------------------------------------------------------------

insert into public.genres (id, sort, search_terms) values
  ('strategy',   11, 'estrategia strategy tower defense defensa torres'),
  ('shooter',    12, 'disparos shooter tiros naves shmup'),
  ('simulation', 13, 'simulacion simulation granja gestion management'),
  ('sports',     14, 'deportes sports futbol soccer basket'),
  ('fighting',   15, 'lucha fighting peleas'),
  ('idle',       16, 'idle incremental clicker');

-- Sin tope propio: el trigger descarta duplicados y valida contra el catálogo, así que nunca puede haber más géneros
-- que los que existen.
alter table public.profiles add column favorite_genres text[] not null default '{}';

-- Cada persona edita los suyos (la policy profiles_update_own ya limita la fila).
grant update (favorite_genres) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3) Foto de perfil
--    Los bytes viven en el almacenamiento de objetos (Cloudflare R2; en local, el S3 de Supabase Storage) y acá solo
--    se guarda la ruta. La base exige que la ruta esté dentro de la carpeta de la propia persona
--    («avatars/<su id>/<32 hex>.webp|jpg|png»): nadie puede apuntar su foto a un archivo ajeno ni salirse con «..».
-- ---------------------------------------------------------------------------------------------

alter table public.profiles drop constraint profiles_avatar_len;
alter table public.profiles
  add constraint profiles_avatar_path_fmt check (
    avatar_path is null
    or avatar_path ~ ('^avatars/' || id::text || '/[0-9a-f]{32}\.(webp|jpg|png)$')
  );

-- ---------------------------------------------------------------------------------------------
-- 4) Trigger de normalización: ahora también valida los géneros (y descarta elementos NULL).
-- ---------------------------------------------------------------------------------------------

create or replace function private.profiles_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name);
  new.bio := btrim(new.bio);
  new.city := nullif(btrim(new.city), '');
  -- Motores: sin duplicados, ordenados y todos existentes en el catálogo.
  new.engines := coalesce((select array_agg(distinct e order by e) from unnest(new.engines) as e where e is not null), '{}');
  if exists (select 1 from unnest(new.engines) as e where e not in (select id from public.engines)) then
    raise exception 'invalid_engine' using errcode = '22023';
  end if;
  -- Géneros favoritos: lo mismo.
  new.favorite_genres := coalesce(
    (select array_agg(distinct g order by g) from unnest(new.favorite_genres) as g where g is not null), '{}'
  );
  if exists (select 1 from unnest(new.favorite_genres) as g where g not in (select id from public.genres)) then
    raise exception 'invalid_genre' using errcode = '22023';
  end if;
  return new;
end;
$$;
