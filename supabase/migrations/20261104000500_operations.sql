-- Trafal · 05 · Operación: partidas, notificaciones, reportes, reclamos de copyright,
--               juego de la semana y registro de moderación.

-- ---------------------------------------------------------------------------------------------
-- Partidas (plays): inicio, duración aproximada (latidos con la pestaña visible) y dispositivo.
-- Sin datos personales: ni IP ni user agent, solo la clase de dispositivo.
-- Nadie accede a la tabla directamente: altas/latidos y estadísticas van por funciones (Fase 2).
-- ---------------------------------------------------------------------------------------------

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  version_id uuid references public.game_versions (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  session_id uuid not null,
  device text not null check (device in ('desktop', 'mobile', 'tablet')),
  started_at timestamptz not null default now(),
  last_beat_at timestamptz not null default now(),
  -- Tope de 4 horas por partida: evita inflar el promedio con pestañas olvidadas.
  active_seconds integer not null default 0 check (active_seconds between 0 and 14400)
);

-- Una partida por sesión de página y juego (deduplica reintentos y recargas).
create unique index plays_session_key on public.plays (game_id, session_id);
create index plays_game_idx on public.plays (game_id, started_at desc);

-- ---------------------------------------------------------------------------------------------
-- Notificaciones (campanita). Las crean triggers/funciones; la persona destinataria solo las lee
-- y las marca como leídas.
-- ---------------------------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'comment', 'reply', 'like', 'follow', 'helpful', 'version_ready', 'version_error', 'moderation'
  )),
  actor_id uuid references public.profiles (id) on delete set null,
  game_id uuid references public.games (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  version_id uuid references public.game_versions (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------------------------
-- Reportes de contenido (juegos, avances, comentarios, perfiles)
-- ---------------------------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('game', 'post', 'comment', 'profile')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'abuse', 'inappropriate', 'copyright', 'broken', 'other')),
  detail text not null default '' check (char_length(detail) <= 1000),
  -- Copia del contenido al momento del reporte (evidencia aunque después se edite o borre).
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now()
);

-- No se puede reportar dos veces lo mismo mientras el primer reporte siga abierto.
create unique index reports_one_open_per_reporter
  on public.reports (reporter_id, target_type, target_id) where status in ('open', 'reviewing');
create index reports_queue_idx on public.reports (status, created_at) where status in ('open', 'reviewing');

create function private.reports_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.detail := btrim(new.detail);
  new.snapshot := case new.target_type
    when 'game' then (
      select jsonb_build_object('title', g.title, 'short_description', g.short_description, 'owner', p.username)
      from public.games g join public.profiles p on p.id = g.owner_id where g.id = new.target_id)
    when 'post' then (
      select jsonb_build_object('kind', x.kind, 'body', x.body, 'author', p.username)
      from public.posts x join public.profiles p on p.id = x.author_id where x.id = new.target_id)
    when 'comment' then (
      select jsonb_build_object('body', c.body, 'author', p.username)
      from public.comments c join public.profiles p on p.id = c.author_id where c.id = new.target_id)
    when 'profile' then (
      select jsonb_build_object('username', p.username, 'display_name', p.display_name, 'bio', p.bio)
      from public.profiles p where p.id = new.target_id)
  end;
  if new.snapshot is null then
    raise exception 'report_target_not_found';
  end if;
  return new;
end;
$$;

create trigger reports_before_insert
  before insert on public.reports
  for each row execute function private.reports_before_insert();

-- ---------------------------------------------------------------------------------------------
-- Reclamos de derechos de autor (formulario público; el alta pasa por una función en la Fase 5)
-- ---------------------------------------------------------------------------------------------

create table public.copyright_claims (
  id uuid primary key default gen_random_uuid(),
  claimant_name text not null check (char_length(btrim(claimant_name)) between 1 and 120),
  claimant_email text not null check (claimant_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(claimant_email) <= 200),
  claimant_org text check (claimant_org is null or char_length(claimant_org) <= 120),
  work_description text not null check (char_length(btrim(work_description)) between 10 and 2000),
  original_url text check (original_url is null or char_length(original_url) <= 500),
  infringing_urls text[] not null check (cardinality(infringing_urls) between 1 and 10),
  statement_good_faith boolean not null check (statement_good_faith),
  statement_accuracy boolean not null check (statement_accuracy),
  signature text not null check (char_length(btrim(signature)) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  game_id uuid references public.games (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now()
);

create index copyright_claims_queue_idx on public.copyright_claims (status, created_at);

-- ---------------------------------------------------------------------------------------------
-- Primer juego de la semana (lo elige un admin entre los "primer juego"; la semana arranca lunes)
-- ---------------------------------------------------------------------------------------------

create table public.featured_games (
  week_start date primary key,
  game_id uuid not null unique references public.games (id) on delete cascade,
  chosen_by uuid references public.profiles (id) on delete set null,
  quote text check (quote is null or char_length(quote) <= 280),
  created_at timestamptz not null default now(),
  constraint featured_games_week_is_monday check (extract(isodow from week_start) = 1)
);

create function private.featured_games_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.games g
    where g.id = new.game_id and g.is_first_game and g.status = 'published'
  ) then
    raise exception 'featured_requires_published_first_game';
  end if;
  return new;
end;
$$;

create trigger featured_games_before_write
  before insert or update on public.featured_games
  for each row execute function private.featured_games_before_write();

-- ---------------------------------------------------------------------------------------------
-- Registro de moderación (solo se agrega; ni siquiera el dueño de la tabla puede editarlo)
-- ---------------------------------------------------------------------------------------------

create table public.moderation_log (
  id bigint generated always as identity primary key,
  -- Sin FK a propósito: el registro sobrevive aunque se borre la cuenta del admin.
  admin_id uuid not null,
  admin_username text not null,
  action text not null check (char_length(action) between 1 and 50),
  target_type text not null check (target_type in ('game', 'post', 'comment', 'profile', 'report', 'claim', 'featured')),
  target_id uuid,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);

create index moderation_log_idx on public.moderation_log (created_at desc);

create function private.moderation_log_immutable() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'moderation_log_is_append_only';
end;
$$;

create trigger moderation_log_immutable
  before update or delete on public.moderation_log
  for each row execute function private.moderation_log_immutable();

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.plays            enable row level security;
alter table public.notifications    enable row level security;
alter table public.reports          enable row level security;
alter table public.copyright_claims enable row level security;
alter table public.featured_games   enable row level security;
alter table public.moderation_log   enable row level security;

-- plays: solo admins leen la tabla cruda. Todo lo demás pasa por funciones.
create policy plays_select_admin on public.plays
  for select to authenticated using (private.is_admin());

revoke all on public.plays from anon, authenticated;
grant select on public.plays to authenticated;

-- notifications: cada persona ve, marca como leídas y descarta las suyas.
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- reports: cualquiera con cuenta activa reporta; cada quien ve los suyos; los admins ven todos.
create policy reports_insert on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and private.can_write());
create policy reports_select on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_admin());

-- Resolver un reporte (cambiar estado, nota) lo hace una función de moderación que además deja
-- rastro en moderation_log (Fase 5): por eso no hay UPDATE directo ni siquiera para admins.
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, detail) on public.reports to authenticated;

-- copyright_claims: solo las leen admins.
create policy copyright_claims_admin_select on public.copyright_claims
  for select to authenticated using (private.is_admin());

-- El alta (formulario público) y la resolución van por funciones (Fase 5), no por la tabla.
revoke all on public.copyright_claims from anon, authenticated;
grant select on public.copyright_claims to authenticated;

-- featured_games: lo ve todo el mundo.
create policy featured_games_select on public.featured_games
  for select to anon, authenticated using (true);

-- Elegir el juego de la semana lo hace una función de moderación (Fase 5): sin escritura directa.
revoke all on public.featured_games from anon, authenticated;
grant select on public.featured_games to anon, authenticated;

-- moderation_log: lectura para admins; las altas las hacen las funciones de moderación.
create policy moderation_log_admin_select on public.moderation_log
  for select to authenticated using (private.is_admin());

revoke all on public.moderation_log from anon, authenticated;
grant select on public.moderation_log to authenticated;
