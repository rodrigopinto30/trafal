-- ---------------------------------------------------------------------------------------------
-- The creators directory: people who have published at least one game, found by name, engine or favorite genre.
--
-- explore_creators(query, engine, genre, sort, limit, offset) returns the ids of the matching profiles, in the order asked for,
-- with the total number of matches. The app loads the profiles by id and keeps this order.
--
-- Who is listed: only profiles with at least one PUBLISHED game (a player with no games is not a creator yet).
-- Text:          each word has to start a word of the display name or of the @username (accents and capitals do not matter).
--                Only letters and numbers of what the person typed survive, so nothing reaches the query as an operator.
-- engine/genre:  the engines the person uses / the genres they like (both are on their profile).
-- Order:         newest   most recently joined first, which is the default: Trafal is for people who are just starting out
--                followers the most followed first
--                games    the most published games first
--
-- SECURITY INVOKER: it runs with the permissions of whoever calls it. Profiles are public and games are filtered by `published`.
-- ---------------------------------------------------------------------------------------------

create function public.explore_creators(
  p_query text default null,
  p_engine text default null,
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
           p.engines, p.favorite_genres
    from public.profiles p
  ) c
  where c.games_count > 0
    and not exists (select 1 from unnest(v_words) as w where c.doc not like '% ' || w || '%')
    and (coalesce(p_engine, '') = '' or p_engine = any (c.engines))
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

revoke all on function public.explore_creators(text, text, text, text, integer, integer) from public;
grant execute on function public.explore_creators(text, text, text, text, integer, integer) to anon, authenticated;
