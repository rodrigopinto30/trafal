-- ---------------------------------------------------------------------------------------------
-- Web only: a game is a web game, and nothing else is asked about it.
--
-- Trafal no longer asks which engine a game was made with, whether it works on phones or which aspect ratio it needs: the
-- player is responsive and every game is a plain web game. This removes those fields from games and profiles, the catalog of
-- engines, and the filters that used them (explore_games, explore_creators). The worker keeps detecting whether a game needs
-- cross-origin isolation (`needs_isolation`), which is a delivery requirement and not a label.
--
-- `is_first_game` stays: the featured game of the week is still chosen among published first games, only the upload form no
-- longer asks for it.
-- ---------------------------------------------------------------------------------------------

create or replace function private.build_game_search_doc(g public.games) returns tsvector
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_genre text;
  v_user text;
  v_name text;
  d regdictionary := 'extensions.unaccent'::regdictionary;
begin
  select search_terms into v_genre from public.genres where id = g.genre_id;
  select translate(username, '_.', '  '), display_name into v_user, v_name
    from public.profiles where id = g.owner_id;

  return
    setweight(to_tsvector('simple', extensions.unaccent(d, coalesce(g.title, ''))), 'A') ||
    setweight(to_tsvector('simple', extensions.unaccent(d, coalesce(g.short_description, ''))), 'B') ||
    setweight(to_tsvector('simple', extensions.unaccent(d, array_to_string(g.tags, ' '))), 'B') ||
    setweight(to_tsvector('simple', extensions.unaccent(d, coalesce(v_genre, ''))), 'C') ||
    setweight(to_tsvector('simple', extensions.unaccent(d, concat_ws(' ', v_user, v_name))), 'C');
end;
$$;

create or replace function private.profiles_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name);
  new.bio := btrim(new.bio);
  new.city := nullif(btrim(new.city), '');
  new.favorite_genres := coalesce(
    (select array_agg(distinct g order by g) from unnest(new.favorite_genres) as g where g is not null), '{}'
  );
  if exists (select 1 from unnest(new.favorite_genres) as g where g not in (select id from public.genres)) then
    raise exception 'invalid_genre' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop function public.explore_games(text, text, text, boolean, text, integer, integer);

create function public.explore_games(
  p_query text default null,
  p_genre text default null,
  p_sort text default 'recent',
  p_limit integer default 24,
  p_offset integer default 0
) returns table (id uuid, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query tsquery;
  v_sort text := case when p_sort in ('recent', 'plays', 'trending', 'relevance') then p_sort else 'recent' end;
begin
  select to_tsquery('simple', string_agg(w || ':*', ' & ')) into v_query
  from (
    select w
    from unnest(
      regexp_split_to_array(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, left(coalesce(p_query, ''), 80))),
        '[^[:alnum:]]+'
      )
    ) as w
    where w <> ''
    limit 8
  ) words;

  if v_query is null and v_sort = 'relevance' then
    v_sort := 'recent';
  end if;

  return query
  select g.id, count(*) over () as total
  from public.games g
  left join (
    select p.game_id, count(*) as recent_plays
    from public.plays p
    where p.started_at >= now() - interval '7 days'
    group by p.game_id
  ) trend on trend.game_id = g.id
  where g.status = 'published'
    and (v_query is null or g.search_doc @@ v_query)
    and (coalesce(p_genre, '') = '' or g.genre_id = p_genre)
  order by
    case when v_sort = 'relevance' then ts_rank(g.search_doc, v_query) end desc nulls last,
    case when v_sort = 'trending' then coalesce(trend.recent_plays, 0) end desc nulls last,
    case when v_sort = 'trending' then g.like_count end desc nulls last,
    case when v_sort = 'plays' then g.play_count end desc nulls last,
    g.published_at desc,
    g.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
end;
$$;

revoke all on function public.explore_games(text, text, text, integer, integer) from public;
grant execute on function public.explore_games(text, text, text, integer, integer) to anon, authenticated;

drop function public.explore_creators(text, text, text, text, integer, integer);

create function public.explore_creators(
  p_query text default null,
  p_genre text default null,
  p_sort text default 'newest',
  p_limit integer default 12,
  p_offset integer default 0
) returns table (id uuid, total bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_words text[];
  v_sort text := case when p_sort in ('newest', 'followers', 'games') then p_sort else 'newest' end;
begin
  select coalesce(array_agg(w), '{}') into v_words
  from (
    select w
    from unnest(
      regexp_split_to_array(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, left(coalesce(p_query, ''), 80))),
        '[^[:alnum:]]+'
      )
    ) as w
    where w <> ''
    limit 8
  ) words;

  return query
  select c.id, count(*) over () as total
  from (
    select p.id, p.created_at, p.followers_count,
           ' ' || lower(extensions.unaccent('extensions.unaccent'::regdictionary, p.display_name)) || ' ' || regexp_replace(p.username, '[^a-z0-9]+', ' ', 'g') as doc,
           (select count(*) from public.games g where g.owner_id = p.id and g.status = 'published') as games_count,
           p.favorite_genres
    from public.profiles p
  ) c
  where c.games_count > 0
    and not exists (select 1 from unnest(v_words) as w where c.doc not like '% ' || w || '%')
    and (coalesce(p_genre, '') = '' or p_genre = any (c.favorite_genres))
  order by
    case when v_sort = 'followers' then c.followers_count end desc nulls last,
    case when v_sort = 'games' then c.games_count end desc nulls last,
    case when v_sort <> 'newest' then c.followers_count end desc nulls last,
    c.created_at desc,
    c.id
  limit least(greatest(coalesce(p_limit, 12), 1), 48)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
end;
$$;

revoke all on function public.explore_creators(text, text, text, integer, integer) from public;
grant execute on function public.explore_creators(text, text, text, integer, integer) to anon, authenticated;

drop function worker.complete_version(uuid, integer, bigint, bigint, text, boolean, jsonb);

create function worker.complete_version(
  p_version_id uuid,
  p_file_count integer,
  p_unpacked_bytes bigint,
  p_size_bytes bigint,
  p_needs_isolation boolean,
  p_scan_flags jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
  v_status text;
begin
  select v.game_id, v.status into v_game_id, v_status from public.game_versions v where v.id = p_version_id for update;
  if not found then
    raise exception 'version_not_found';
  end if;
  if v_status <> 'processing' then
    raise exception 'invalid_state';
  end if;

  update public.game_versions v
  set status = 'ready',
      file_count = p_file_count,
      unpacked_bytes = p_unpacked_bytes,
      size_bytes = p_size_bytes,
      needs_isolation = coalesce(p_needs_isolation, false),
      scan_flags = coalesce(p_scan_flags, '[]'::jsonb),
      error_code = null,
      error_params = '{}'::jsonb,
      processed_at = now(),
      locked_at = null,
      locked_by = null
  where v.id = p_version_id;

  update public.games g set active_version_id = p_version_id where g.id = v_game_id and g.active_version_id is null;
end;
$$;

revoke all on function worker.complete_version(uuid, integer, bigint, bigint, boolean, jsonb) from public;
grant execute on function worker.complete_version(uuid, integer, bigint, bigint, boolean, jsonb) to game_worker;

drop index public.games_engine_idx;
alter table public.games
  drop column engine_id,
  drop column works_on_mobile,
  drop column display_ratio;
alter table public.game_versions drop column detected_engine;
alter table public.profiles drop column engines;
drop table public.engines;

update public.games g set search_doc = private.build_game_search_doc(g);
