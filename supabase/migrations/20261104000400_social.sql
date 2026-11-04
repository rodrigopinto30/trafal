-- Trafal · 04 · Social: avances (posts), comentarios, me gusta y guardados
--
-- Reglas de oro:
--   * Cada persona edita/borra solo lo suyo (verificado por RLS, no por la interfaz).
--   * Contadores (likes, comentarios...) y la marca "Me sirvió" NO se pueden escribir desde el
--     cliente: los mantienen triggers y funciones SECURITY DEFINER.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('avance', 'nuevo_juego', 'pide_feedback', 'hito')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  game_id uuid references public.games (id) on delete cascade,
  -- Versión que anuncia el avance (opcional, solo si hay juego).
  version_id uuid,
  -- Dato destacado de un hito ("100" en "100 personas jugaron...").
  highlight text check (highlight is null or char_length(highlight) between 1 and 12),
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  share_count integer not null default 0 check (share_count >= 0),
  save_count integer not null default 0 check (save_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_new_game_needs_game check (kind <> 'nuevo_juego' or game_id is not null),
  constraint posts_version_needs_game check (version_id is null or game_id is not null),
  constraint posts_version_fk foreign key (version_id, game_id)
    references public.game_versions (id, game_id) on delete set null (version_id)
);

create index posts_feed_idx on public.posts (created_at desc) where status = 'published';
create index posts_kind_feed_idx on public.posts (kind, created_at desc) where status = 'published';
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_game_idx on public.posts (game_id, created_at desc) where game_id is not null;

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  kind text not null check (kind in ('image', 'gif', 'video')),
  path text not null check (char_length(path) <= 300),
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm')),
  -- Tope de 20 MB (imágenes, GIF y MP4/WebM cortos; sin transcodificación en el MVP).
  bytes integer not null check (bytes > 0 and bytes <= 20971520),
  width smallint check (width is null or width > 0),
  height smallint check (height is null or height > 0),
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  position smallint not null check (position between 1 and 4),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

-- Comentarios: sobre un avance O sobre un juego (pestaña "Feedback"), con respuestas de un nivel.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  game_id uuid references public.games (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  -- Si responde a una de las preguntas de feedback del creador.
  question_id uuid references public.game_questions (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  label text check (label in ('liked', 'suggestion')),
  -- "Me sirvió": solo lo marca quien creó el juego/avance (función, no UPDATE directo).
  is_helpful boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_one_target check ((post_id is not null)::int + (game_id is not null)::int = 1),
  constraint comments_question_needs_game check (question_id is null or game_id is not null)
);

create index comments_post_idx on public.comments (post_id, created_at) where post_id is not null;
create index comments_game_idx on public.comments (game_id, created_at) where game_id is not null;
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index comments_author_idx on public.comments (author_id, created_at desc);
-- Una sola respuesta por persona y pregunta de feedback.
create unique index comments_one_answer_per_question
  on public.comments (question_id, author_id) where question_id is not null;

create table public.post_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_likes_post_idx on public.post_likes (post_id);

create table public.game_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index game_likes_game_idx on public.game_likes (game_id);

create table public.post_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_saves_user_idx on public.post_saves (user_id, created_at desc);

create table public.game_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index game_saves_user_idx on public.game_saves (user_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

create function private.posts_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.body := btrim(new.body);
  new.highlight := nullif(btrim(new.highlight), '');
  -- Solo se puede vincular un juego propio.
  if new.game_id is not null
     and not exists (select 1 from public.games g where g.id = new.game_id and g.owner_id = new.author_id) then
    raise exception 'game_not_owned';
  end if;
  return new;
end;
$$;

create trigger posts_before_write
  before insert or update on public.posts
  for each row execute function private.posts_before_write();

create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function private.touch_updated_at();

create function private.comments_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.comments;
begin
  new.body := btrim(new.body);

  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    if not found then
      raise exception 'parent_not_found';
    end if;
    -- Solo un nivel de respuestas, sobre el mismo avance/juego.
    if v_parent.parent_id is not null then
      raise exception 'reply_depth_exceeded';
    end if;
    if v_parent.post_id is distinct from new.post_id or v_parent.game_id is distinct from new.game_id then
      raise exception 'parent_target_mismatch';
    end if;
    if new.label is not null then
      raise exception 'reply_cannot_have_label';
    end if;
    if new.question_id is not null then
      raise exception 'reply_cannot_answer_question';
    end if;
  end if;

  if new.question_id is not null
     and not exists (select 1 from public.game_questions q where q.id = new.question_id and q.game_id = new.game_id) then
    raise exception 'question_mismatch';
  end if;

  return new;
end;
$$;

create trigger comments_before_write
  before insert or update on public.comments
  for each row execute function private.comments_before_write();

create trigger comments_touch_updated_at
  before update on public.comments
  for each row execute function private.touch_updated_at();

-- Cuenta solo comentarios publicados (si un admin oculta uno, el contador baja).
create function private.comments_count() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid;
  v_game uuid;
  v_delta integer := 0;
begin
  if tg_op = 'INSERT' then
    v_post := new.post_id; v_game := new.game_id;
    v_delta := (new.status = 'published')::int;
  elsif tg_op = 'DELETE' then
    v_post := old.post_id; v_game := old.game_id;
    v_delta := -((old.status = 'published')::int);
  else
    v_post := new.post_id; v_game := new.game_id;
    v_delta := (new.status = 'published')::int - (old.status = 'published')::int;
  end if;

  if v_delta <> 0 then
    if v_post is not null then
      perform private.bump_counter('public', 'posts', 'comment_count', v_post, v_delta);
    else
      perform private.bump_counter('public', 'games', 'comment_count', v_game, v_delta);
    end if;
  end if;
  return null;
end;
$$;

create trigger comments_count
  after insert or update of status or delete on public.comments
  for each row execute function private.comments_count();

-- Contador de me gusta / guardados. Argumentos: tabla destino, columna contador, columna FK.
create function private.like_save_counter() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_id := (to_jsonb(new) ->> tg_argv[2])::uuid;
  else
    v_id := (to_jsonb(old) ->> tg_argv[2])::uuid;
  end if;
  perform private.bump_counter('public', tg_argv[0], tg_argv[1], v_id, case when tg_op = 'INSERT' then 1 else -1 end);
  return null;
end;
$$;

create trigger post_likes_counter after insert or delete on public.post_likes
  for each row execute function private.like_save_counter('posts', 'like_count', 'post_id');
create trigger game_likes_counter after insert or delete on public.game_likes
  for each row execute function private.like_save_counter('games', 'like_count', 'game_id');
create trigger post_saves_counter after insert or delete on public.post_saves
  for each row execute function private.like_save_counter('posts', 'save_count', 'post_id');
create trigger game_saves_counter after insert or delete on public.game_saves
  for each row execute function private.like_save_counter('games', 'save_count', 'game_id');

-- ¿El usuario autenticado es autor de este avance?
create function private.owns_post(p_post_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.author_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_post(uuid) from public;
grant execute on function private.owns_post(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.posts      enable row level security;
alter table public.post_media enable row level security;
alter table public.comments   enable row level security;
alter table public.post_likes enable row level security;
alter table public.game_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.game_saves enable row level security;

-- Avances
create policy posts_select on public.posts
  for select to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()) or private.is_admin());

create policy posts_insert on public.posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_write());

create policy posts_update on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) and status = 'published' and private.can_write())
  with check (author_id = (select auth.uid()) and status = 'published' and private.can_write());

create policy posts_delete on public.posts
  for delete to authenticated
  using (author_id = (select auth.uid()) and private.can_write());

revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert (author_id, kind, body, game_id, version_id, highlight) on public.posts to authenticated;
-- El tipo y el juego vinculado no cambian después de publicar; el estado es de moderación.
grant update (body, highlight) on public.posts to authenticated;
grant delete on public.posts to authenticated;

-- Archivos de un avance: heredan la visibilidad del avance; solo su autor los gestiona.
create policy post_media_select on public.post_media
  for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

create policy post_media_insert on public.post_media
  for insert to authenticated
  with check (private.owns_post(post_id) and private.can_write());
create policy post_media_update on public.post_media
  for update to authenticated
  using (private.owns_post(post_id) and private.can_write())
  with check (private.owns_post(post_id) and private.can_write());
create policy post_media_delete on public.post_media
  for delete to authenticated
  using (private.owns_post(post_id) and private.can_write());

revoke all on public.post_media from anon, authenticated;
grant select on public.post_media to anon, authenticated;
grant insert (post_id, kind, path, mime, bytes, width, height, alt_text, position),
      update (alt_text, position),
      delete
  on public.post_media to authenticated;

-- Comentarios
create policy comments_select on public.comments
  for select to anon, authenticated
  using (
    (status = 'published' and (
         (post_id is not null and exists (select 1 from public.posts p where p.id = post_id))
      or (game_id is not null and exists (select 1 from public.games g where g.id = game_id))
    ))
    or author_id = (select auth.uid())
    or private.is_admin()
  );

create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.can_write()
    and (
         (post_id is not null and exists (select 1 from public.posts p where p.id = post_id))
      or (game_id is not null and exists (select 1 from public.games g where g.id = game_id))
    )
  );

create policy comments_update on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and private.can_write())
  with check (author_id = (select auth.uid()) and private.can_write());

create policy comments_delete on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) and private.can_write());

revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (author_id, post_id, game_id, parent_id, question_id, body, label) on public.comments to authenticated;
-- `is_helpful` y `status` quedan fuera a propósito.
grant update (body, label) on public.comments to authenticated;
grant delete on public.comments to authenticated;

-- Me gusta y guardados: privados (cada persona ve los suyos; el público ve solo los contadores).
create policy post_likes_select on public.post_likes for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy post_likes_insert on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_write()
              and exists (select 1 from public.posts p where p.id = post_id));
create policy post_likes_delete on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy game_likes_select on public.game_likes for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy game_likes_insert on public.game_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_write()
              and exists (select 1 from public.games g where g.id = game_id));
create policy game_likes_delete on public.game_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy post_saves_select on public.post_saves for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy post_saves_insert on public.post_saves for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_write()
              and exists (select 1 from public.posts p where p.id = post_id));
create policy post_saves_delete on public.post_saves for delete to authenticated
  using (user_id = (select auth.uid()));

create policy game_saves_select on public.game_saves for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy game_saves_insert on public.game_saves for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_write()
              and exists (select 1 from public.games g where g.id = game_id));
create policy game_saves_delete on public.game_saves for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.post_likes, public.game_likes, public.post_saves, public.game_saves from anon, authenticated;
grant select, delete on public.post_likes, public.game_likes, public.post_saves, public.game_saves to authenticated;
grant insert (user_id, post_id) on public.post_likes to authenticated;
grant insert (user_id, game_id) on public.game_likes to authenticated;
grant insert (user_id, post_id) on public.post_saves to authenticated;
grant insert (user_id, game_id) on public.game_saves to authenticated;
