-- ---------------------------------------------------------------------------------------------
-- «Sorprendeme»: a published game picked at random.
--
-- random_game(exclude) returns the public id of one PUBLISHED game, chosen with the same chance for all of them (no weight for
-- the most played ones, so new creators get their turn). The game the person is looking at can be left out; if it is the only
-- published game there is, it comes back anyway (there is nothing else to show). With no published game it returns nothing.
--
-- SECURITY INVOKER: it runs with the permissions of whoever calls it, so the row-level security of `games` still applies, and
-- `published` is filtered on top because that policy also shows the caller their own drafts.
-- ---------------------------------------------------------------------------------------------

create function public.random_game(p_exclude text default null) returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select coalesce(
    (select g.public_id from public.games g where g.status = 'published' and g.public_id is distinct from p_exclude order by random() limit 1),
    (select g.public_id from public.games g where g.status = 'published' limit 1)
  )
$$;

revoke all on function public.random_game(text) from public;
grant execute on function public.random_game(text) to anon, authenticated;
