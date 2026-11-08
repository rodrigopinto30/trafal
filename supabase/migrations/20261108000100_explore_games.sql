-- ---------------------------------------------------------------------------------------------
-- Exploring games: text search + filters + order, one page at a time.
--
-- explore_games(query, genre, engine, mobile_only, sort, limit, offset) returns the ids of the PUBLISHED games that match, in
-- the order asked for, with the total number of matches (so the page can say "48 games" and offer more pages). The app loads
-- the games by id and keeps this order, like it does for the search suggestions.
--
-- Order:
--   recent     newest published first
--   plays      most played first (all time)
--   trending   most played in the last 7 days first; ties go to the most liked, then the newest
--   relevance  how well the text matches (only with a text; without one it is the same as recent)
--
-- It is SECURITY DEFINER because "trending" counts rows of `plays`, which only admins can read. That is safe because the
-- function only ever returns ids of published games and counts: it never shows who played, when or from what.
-- Every filter is optional (null or empty means "no filter"). The text is cleaned the same way as in search_games: only letters
-- and numbers survive, each word is a prefix, so nothing the person types ever reaches the query as an operator.
-- ---------------------------------------------------------------------------------------------

create function public.explore_games(
  p_query text default null,
  p_genre text default null,
  p_engine text default null,
  p_mobile_only boolean default false,
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
    and (coalesce(p_engine, '') = '' or g.engine_id = p_engine)
    and (not coalesce(p_mobile_only, false) or g.works_on_mobile)
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

revoke all on function public.explore_games(text, text, text, boolean, text, integer, integer) from public;
grant execute on function public.explore_games(text, text, text, boolean, text, integer, integer) to anon, authenticated;
