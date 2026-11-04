-- Trafal · 02 · Identidad: catálogos, perfiles, seguidores y onboarding

-- ---------------------------------------------------------------------------------------------
-- Catálogos (motores y géneros). Las etiquetas visibles viven en i18n (apps/web/messages);
-- `search_terms` solo alimenta el buscador de texto (en español e inglés).
-- ---------------------------------------------------------------------------------------------

create table public.engines (
  id text primary key check (id ~ '^[a-z0-9_]{2,20}$'),
  sort smallint not null default 0,
  search_terms text not null default ''
);

create table public.genres (
  id text primary key check (id ~ '^[a-z0-9_]{2,20}$'),
  sort smallint not null default 0,
  search_terms text not null default ''
);

insert into public.engines (id, sort, search_terms) values
  ('godot',     1, 'godot'),
  ('unity',     2, 'unity webgl'),
  ('gamemaker', 3, 'gamemaker game maker'),
  ('phaser',    4, 'phaser html5 javascript'),
  ('pico8',     5, 'pico-8 pico8 fantasy console'),
  ('scratch',   6, 'scratch turbowarp'),
  ('twine',     7, 'twine ficcion interactiva interactive fiction'),
  ('construct', 8, 'construct construct3'),
  ('other',    99, '');

insert into public.genres (id, sort, search_terms) values
  ('platformer',  1, 'plataformas plataforma platformer platform'),
  ('arcade',      2, 'arcade'),
  ('puzzle',      3, 'puzzle rompecabezas'),
  ('narrative',   4, 'narrativo narrativa historia story narrative'),
  ('roguelike',   5, 'roguelike roguelite mazmorra dungeon'),
  ('cozy',        6, 'cozy relajante tranquilo'),
  ('horror',      7, 'terror horror miedo'),
  ('rhythm',      8, 'ritmo rhythm musica music'),
  ('racing',      9, 'carreras racing autos'),
  ('adventure',  10, 'aventura adventure exploracion'),
  ('other',      99, '');

alter table public.engines enable row level security;
alter table public.genres  enable row level security;

create policy engines_select on public.engines for select to anon, authenticated using (true);
create policy genres_select  on public.genres  for select to anon, authenticated using (true);

revoke all on public.engines, public.genres from anon, authenticated;
grant select on public.engines, public.genres to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Perfiles públicos
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_path text,
  bio text not null default '',
  city text,
  country text,
  engines text[] not null default '{}',
  followers_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username ~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$' and username !~ '[_.]{2}'
  ),
  constraint profiles_display_name_len check (char_length(btrim(display_name)) between 1 and 50),
  constraint profiles_bio_len check (char_length(bio) <= 280),
  constraint profiles_city_len check (city is null or char_length(city) between 1 and 80),
  constraint profiles_country_fmt check (country is null or country ~ '^[A-Z]{2}$'),
  constraint profiles_avatar_len check (avatar_path is null or char_length(avatar_path) <= 300),
  constraint profiles_engines_max check (cardinality(engines) <= 8),
  constraint profiles_counts_nonneg check (followers_count >= 0 and following_count >= 0)
);

-- Los usernames se guardan siempre en minúsculas (lo exige el CHECK), así que el índice único
-- ya es "case-insensitive". Las búsquedas usan `username = lower(...)`.
create unique index profiles_username_key on public.profiles (username);

-- Datos privados de la cuenta: rol, suspensión, aceptación de términos, idioma.
-- Separados de `profiles` porque RLS filtra filas, no columnas.
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_until timestamptz,
  suspension_reason text check (suspension_reason is null or char_length(suspension_reason) <= 500),
  locale text not null default 'es' check (locale in ('es', 'en')),
  terms_version text not null check (char_length(terms_version) between 1 and 32),
  terms_accepted_at timestamptz not null,
  age_confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id, created_at desc);
create index follows_follower_idx on public.follows (follower_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Helpers de permisos (los usan las policies de TODAS las tablas)
-- ---------------------------------------------------------------------------------------------

-- ¿El usuario autenticado es admin activo?
create function private.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pp.role = 'admin'
       and (pp.status = 'active' or (pp.suspended_until is not null and pp.suspended_until <= now()))
    from public.profile_private pp
    where pp.id = (select auth.uid())
  ), false);
$$;

-- ¿Puede escribir contenido? Tiene perfil (hizo el onboarding) y no está suspendido.
create function private.can_write() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_private pp
    where pp.id = (select auth.uid())
      and (pp.status = 'active' or (pp.suspended_until is not null and pp.suspended_until <= now()))
  );
$$;

revoke all on function private.is_admin(), private.can_write() from public;
grant execute on function private.is_admin(), private.can_write() to anon, authenticated;

-- Nombres que no se pueden elegir (suplantación / rutas del sitio).
create function private.reserved_usernames() returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'admin', 'administrator', 'administrador', 'root', 'system', 'sistema', 'trafal', 'staff',
    'soporte', 'support', 'help', 'ayuda', 'moderator', 'moderador', 'mod', 'api', 'www', 'null',
    'undefined', 'anonymous', 'anonimo', 'me', 'settings', 'login', 'signup', 'explore', 'feed',
    'games', 'juegos', 'legal', 'terms', 'privacy', 'onboarding', 'auth'
  ];
$$;

revoke all on function private.reserved_usernames() from public;

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

create function private.profiles_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name);
  new.bio := btrim(new.bio);
  new.city := nullif(btrim(new.city), '');
  -- Motores: sin duplicados, ordenados y todos existentes en el catálogo.
  new.engines := coalesce((select array_agg(distinct e order by e) from unnest(new.engines) as e), '{}');
  if exists (select 1 from unnest(new.engines) as e where e not in (select id from public.engines)) then
    raise exception 'invalid_engine' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function private.profiles_before_write();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create function private.follows_count() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.bump_counter('public', 'profiles', 'followers_count', new.followee_id, 1);
    perform private.bump_counter('public', 'profiles', 'following_count', new.follower_id, 1);
  else
    perform private.bump_counter('public', 'profiles', 'followers_count', old.followee_id, -1);
    perform private.bump_counter('public', 'profiles', 'following_count', old.follower_id, -1);
  end if;
  return null;
end;
$$;

create trigger follows_count
  after insert or delete on public.follows
  for each row execute function private.follows_count();

-- ---------------------------------------------------------------------------------------------
-- RLS + privilegios por columna
-- ---------------------------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.profile_private enable row level security;
alter table public.follows         enable row level security;

-- Los perfiles son públicos. Cada persona edita solo el suyo (y solo ciertas columnas).
create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and private.can_write())
  with check (id = (select auth.uid()) and private.can_write());

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
-- No se puede cambiar: id, username (inmutable en el MVP), contadores, fechas.
grant update (display_name, avatar_path, bio, city, country, engines) on public.profiles to authenticated;

-- Datos privados: los lee la propia persona o un admin. Solo se puede cambiar el idioma;
-- rol, suspensión y términos los gestionan funciones SECURITY DEFINER.
create policy profile_private_select on public.profile_private
  for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());

create policy profile_private_update_own on public.profile_private
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profile_private from anon, authenticated;
grant select on public.profile_private to authenticated;
grant update (locale) on public.profile_private to authenticated;

-- Seguidores: el grafo es público; cada persona gestiona solo sus propios "seguir".
create policy follows_select on public.follows
  for select to anon, authenticated using (true);

create policy follows_insert on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and private.can_write());

create policy follows_delete on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

revoke all on public.follows from anon, authenticated;
grant select on public.follows to anon, authenticated;
grant insert (follower_id, followee_id) on public.follows to authenticated;
grant delete on public.follows to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPC: onboarding
-- Los códigos de error son estables (mensaje de la excepción); la interfaz los traduce.
-- ---------------------------------------------------------------------------------------------

create function public.username_available(p_username text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$'
     and lower(btrim(p_username)) !~ '[_.]{2}'
     and not (lower(btrim(p_username)) = any (private.reserved_usernames()))
     and not exists (select 1 from public.profiles where username = lower(btrim(p_username)));
$$;

create function public.complete_onboarding(
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
  if not coalesce(p_age_confirmed, false) then
    raise exception 'age_confirmation_required';
  end if;
  if not coalesce(p_accept_terms, false) then
    raise exception 'terms_required';
  end if;
  if v_username !~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$' or v_username ~ '[_.]{2}' then
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

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

revoke all on function public.complete_onboarding(text, text, text, boolean, boolean, text) from public;
grant execute on function public.complete_onboarding(text, text, text, boolean, boolean, text) to authenticated;
