-- Trafal · 03 · Juegos, capturas, preguntas de feedback y versiones
--
-- Las versiones las crea una función (Fase 2) y su estado SOLO lo cambia el worker de subidas:
-- el dueño del juego nunca puede marcar una versión como "lista" por su cuenta.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  -- Id corto y aleatorio: es el subdominio donde se sirve el juego ({public_id}.GAMES_DOMAIN).
  public_id text not null default private.gen_public_id(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  short_description text not null default '',
  genre_id text references public.genres (id),
  engine_id text references public.engines (id),
  tags text[] not null default '{}',
  cover_path text,
  controls text not null default '',
  works_on_mobile boolean not null default false,
  is_first_game boolean not null default false,
  display_ratio text not null default '16:9',
  -- Link externo opcional (no se juega en el sitio).
  external_url text,
  active_version_id uuid,
  status text not null default 'draft',
  like_count integer not null default 0,
  comment_count integer not null default 0,
  save_count integer not null default 0,
  share_count integer not null default 0,
  play_count integer not null default 0,
  search_doc tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint games_title_len check (char_length(btrim(title)) between 1 and 80),
  constraint games_short_description_len check (char_length(short_description) <= 160),
  constraint games_controls_len check (char_length(controls) <= 500),
  constraint games_cover_len check (cover_path is null or char_length(cover_path) <= 300),
  constraint games_display_ratio check (display_ratio in ('16:9', '4:3', '1:1', '9:16')),
  constraint games_external_url check (
    external_url is null or (external_url ~ '^https?://[^[:space:]]+$' and char_length(external_url) <= 300)
  ),
  constraint games_status check (status in ('draft', 'published', 'hidden', 'removed')),
  constraint games_counts_nonneg check (
    like_count >= 0 and comment_count >= 0 and save_count >= 0 and share_count >= 0 and play_count >= 0
  )
);

create unique index games_public_id_key on public.games (public_id);
-- "¿Es tu primer juego?": como mucho un juego por persona lleva esa insignia.
create unique index games_one_first_game_per_owner on public.games (owner_id) where is_first_game;
create index games_owner_idx on public.games (owner_id, created_at desc);
create index games_published_idx on public.games (published_at desc) where status = 'published';
create index games_genre_idx on public.games (genre_id) where status = 'published';
create index games_engine_idx on public.games (engine_id) where status = 'published';
create index games_search_idx on public.games using gin (search_doc);
create index games_tags_idx on public.games using gin (tags);

create table public.game_screenshots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  path text not null check (char_length(path) <= 300),
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  position smallint not null check (position between 1 and 6),
  created_at timestamptz not null default now(),
  unique (game_id, position)
);

-- Hasta 3 preguntas que el creador quiere que los jugadores respondan.
create table public.game_questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  question text not null check (char_length(btrim(question)) between 3 and 140),
  unique (game_id, position)
);

create table public.game_versions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  -- `number` arma la ruta en el almacenamiento (games/{public_id}/v{number}/); `label` es el
  -- nombre que ve la gente ("v0.3") y lo puede editar el creador.
  number integer not null check (number > 0),
  label text not null check (char_length(btrim(label)) between 1 and 24),
  changelog text not null default '' check (char_length(changelog) <= 2000),
  -- subiendo → procesando → lista | error.
  -- "En cola" no es un estado visible: es `processing` con `locked_at` nulo.
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'error')),
  quarantine_key text,
  declared_size_bytes bigint check (declared_size_bytes is null or declared_size_bytes > 0),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  file_count integer check (file_count is null or file_count >= 0),
  unpacked_bytes bigint check (unpacked_bytes is null or unpacked_bytes >= 0),
  detected_engine text references public.engines (id),
  -- Godot con hilos (u otros) que necesitan aislamiento entre orígenes (COOP/COEP).
  needs_isolation boolean not null default false,
  entry_path text not null default 'index.html',
  scan_flags jsonb not null default '[]'::jsonb,
  -- Código estable del error + parámetros; el mensaje para principiantes lo arma la interfaz (i18n).
  error_code text,
  error_params jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  processed_at timestamptz,
  unique (game_id, number),
  unique (id, game_id)
);

create index game_versions_game_idx on public.game_versions (game_id, number desc);
-- Cola del worker: versiones esperando ser procesadas.
create index game_versions_queue_idx on public.game_versions (uploaded_at) where status = 'processing';

-- La versión activa debe ser de ESTE juego (FK compuesta). El estado "ready" lo valida un trigger.
alter table public.games
  add constraint games_active_version_fk
  foreign key (active_version_id, id)
  references public.game_versions (id, game_id)
  on delete set null (active_version_id);

-- ---------------------------------------------------------------------------------------------
-- Búsqueda de texto: título (A), descripción y etiquetas (B), género/motor/creador (C).
-- Configuración `simple` + unaccent: el contenido es bilingüe y no queremos stemming de un idioma.
-- ---------------------------------------------------------------------------------------------

create function private.build_game_search_doc(g public.games) returns tsvector
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_genre text;
  v_engine text;
  v_user text;
  v_name text;
  d regdictionary := 'extensions.unaccent'::regdictionary;
begin
  select search_terms into v_genre from public.genres where id = g.genre_id;
  select search_terms into v_engine from public.engines where id = g.engine_id;
  select translate(username, '_.', '  '), display_name into v_user, v_name
    from public.profiles where id = g.owner_id;

  return
    setweight(to_tsvector('simple', extensions.unaccent(d, coalesce(g.title, ''))), 'A') ||
    setweight(to_tsvector('simple', extensions.unaccent(d, coalesce(g.short_description, ''))), 'B') ||
    setweight(to_tsvector('simple', extensions.unaccent(d, array_to_string(g.tags, ' '))), 'B') ||
    setweight(to_tsvector('simple', extensions.unaccent(d, concat_ws(' ', v_genre, v_engine))), 'C') ||
    setweight(to_tsvector('simple', extensions.unaccent(d, concat_ws(' ', v_user, v_name))), 'C');
end;
$$;

revoke all on function private.build_game_search_doc(public.games) from public;

create function private.games_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_admin boolean := private.is_admin();
  v_version_status text;
begin
  new.title := btrim(new.title);
  new.short_description := btrim(new.short_description);
  new.controls := btrim(new.controls);

  -- Etiquetas: minúsculas, sin vacías ni duplicadas, máx. 24 caracteres cada una y 8 en total.
  new.tags := coalesce((
    select array_agg(distinct left(lower(btrim(t)), 24) order by left(lower(btrim(t)), 24))
    from unnest(new.tags) as t
    where btrim(t) <> ''
  ), '{}');
  if cardinality(new.tags) > 8 then
    raise exception 'too_many_tags';
  end if;

  -- Quien crea el juego solo puede alternar borrador <-> publicado. Ocultar o dar de baja
  -- (hidden/removed) es moderación: lo hacen los admins y solo los admins pueden revertirlo.
  if tg_op = 'UPDATE' and v_uid is not null and not v_admin
     and new.status is distinct from old.status
     and (old.status not in ('draft', 'published') or new.status not in ('draft', 'published')) then
    raise exception 'status_change_not_allowed';
  end if;

  -- La versión activa tiene que ser de este juego y estar lista.
  if new.active_version_id is not null
     and (tg_op = 'INSERT' or new.active_version_id is distinct from old.active_version_id) then
    select v.status into v_version_status
      from public.game_versions v
     where v.id = new.active_version_id and v.game_id = new.id;
    if not found then
      raise exception 'version_not_found';
    end if;
    if v_version_status <> 'ready' then
      raise exception 'version_not_ready';
    end if;
  end if;

  -- Un juego publicado siempre tiene una versión jugable activa.
  if new.status = 'published' then
    if new.active_version_id is null then
      raise exception 'publish_requires_ready_version';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;

  new.search_doc := private.build_game_search_doc(new);
  return new;
end;
$$;

create trigger games_before_write
  before insert or update on public.games
  for each row execute function private.games_before_write();

create trigger games_touch_updated_at
  before update on public.games
  for each row execute function private.touch_updated_at();

-- Si cambia el nombre de la persona, se reindexan sus juegos (el buscador incluye al creador).
create function private.profiles_reindex_games() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.games g set search_doc = private.build_game_search_doc(g) where g.owner_id = new.id;
  return null;
end;
$$;

create trigger profiles_reindex_games
  after update of username, display_name on public.profiles
  for each row
  when (old.username is distinct from new.username or old.display_name is distinct from new.display_name)
  execute function private.profiles_reindex_games();

-- ¿El usuario autenticado es dueño de este juego? (lo usan las policies de las tablas hijas)
create function private.owns_game(p_game_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.games g
    where g.id = p_game_id and g.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_game(uuid) from public;
grant execute on function private.owns_game(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.games            enable row level security;
alter table public.game_screenshots enable row level security;
alter table public.game_questions   enable row level security;
alter table public.game_versions    enable row level security;

-- Juegos: los publicados los ve cualquiera; borradores y moderados, solo su dueño y los admins.
create policy games_select on public.games
  for select to anon, authenticated
  using (status = 'published' or owner_id = (select auth.uid()) or private.is_admin());

create policy games_insert on public.games
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.can_write());

create policy games_update on public.games
  for update to authenticated
  using (owner_id = (select auth.uid()) and private.can_write())
  with check (owner_id = (select auth.uid()) and private.can_write());

-- Un juego dado de baja por moderación no se puede borrar para evadir el reclamo.
create policy games_delete on public.games
  for delete to authenticated
  using (owner_id = (select auth.uid()) and status in ('draft', 'published') and private.can_write());

revoke all on public.games from anon, authenticated;
grant select on public.games to anon, authenticated;
grant insert (owner_id, title, short_description, genre_id, engine_id, tags, cover_path, controls,
              works_on_mobile, is_first_game, display_ratio, external_url)
  on public.games to authenticated;
-- No se puede tocar: owner_id, public_id, active_version_id (función), contadores, search_doc.
grant update (title, short_description, genre_id, engine_id, tags, cover_path, controls,
              works_on_mobile, is_first_game, display_ratio, external_url, status)
  on public.games to authenticated;
grant delete on public.games to authenticated;

-- Capturas y preguntas heredan la visibilidad del juego (la subconsulta respeta el RLS de `games`).
create policy game_screenshots_select on public.game_screenshots
  for select to anon, authenticated
  using (exists (select 1 from public.games g where g.id = game_id));

create policy game_screenshots_insert on public.game_screenshots
  for insert to authenticated
  with check (private.owns_game(game_id) and private.can_write());
create policy game_screenshots_update on public.game_screenshots
  for update to authenticated
  using (private.owns_game(game_id) and private.can_write())
  with check (private.owns_game(game_id) and private.can_write());
create policy game_screenshots_delete on public.game_screenshots
  for delete to authenticated
  using (private.owns_game(game_id) and private.can_write());

create policy game_questions_select on public.game_questions
  for select to anon, authenticated
  using (exists (select 1 from public.games g where g.id = game_id));

create policy game_questions_insert on public.game_questions
  for insert to authenticated
  with check (private.owns_game(game_id) and private.can_write());
create policy game_questions_update on public.game_questions
  for update to authenticated
  using (private.owns_game(game_id) and private.can_write())
  with check (private.owns_game(game_id) and private.can_write());
create policy game_questions_delete on public.game_questions
  for delete to authenticated
  using (private.owns_game(game_id) and private.can_write());

revoke all on public.game_screenshots, public.game_questions from anon, authenticated;
grant select on public.game_screenshots, public.game_questions to anon, authenticated;
grant insert (game_id, path, alt_text, position), update (path, alt_text, position), delete
  on public.game_screenshots to authenticated;
grant insert (game_id, position, question), update (position, question), delete
  on public.game_questions to authenticated;

-- Versiones: las listas son públicas (pestaña "Versiones"); el dueño ve todas, incluso las que
-- están subiendo o fallaron. Crear una versión y cambiar su estado NO tiene policy ni grant:
-- solo lo hacen funciones SECURITY DEFINER (creación: Fase 2) y el worker.
create policy game_versions_select on public.game_versions
  for select to anon, authenticated
  using (
    (status = 'ready' and exists (select 1 from public.games g where g.id = game_id))
    or private.owns_game(game_id)
    or private.is_admin()
  );

create policy game_versions_update_meta on public.game_versions
  for update to authenticated
  using (private.owns_game(game_id) and private.can_write())
  with check (private.owns_game(game_id) and private.can_write());

revoke all on public.game_versions from anon, authenticated;
grant select on public.game_versions to anon, authenticated;
grant update (label, changelog) on public.game_versions to authenticated;
