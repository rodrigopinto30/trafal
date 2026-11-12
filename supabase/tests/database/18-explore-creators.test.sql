-- The creators directory: only people with a published game, text and genre filters, every order, pages and total.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');
select tests.create_profile('d0000000-0000-0000-0000-000000000004', 'diego');
select tests.create_profile('e0000000-0000-0000-0000-000000000005', 'eli.pixels');

create function pg_temp.names(p_query text default null, p_genre text default null, p_sort text default 'newest', p_limit integer default 12, p_offset integer default 0)
returns text language sql as $$
  select coalesce(string_agg(p.username, ',' order by r.ord), '')
  from (select e.id, row_number() over () as ord from public.explore_creators(p_query, p_genre, p_sort, p_limit, p_offset) e) r
  join public.profiles p on p.id = r.id
$$;

update public.profiles set display_name = 'Ana Gómez', favorite_genres = '{puzzle,cozy}', followers_count = 5, created_at = now() - interval '30 days' where username = 'ana';
update public.profiles set display_name = 'Bruno Ñandú', favorite_genres = '{horror}', followers_count = 20, created_at = now() - interval '20 days' where username = 'bruno';
update public.profiles set display_name = 'Carla Ruiz', favorite_genres = '{puzzle}', followers_count = 1, created_at = now() - interval '10 days' where username = 'carla';
update public.profiles set display_name = 'Diego Sin Juegos', favorite_genres = '{puzzle}', followers_count = 99, created_at = now() - interval '1 day' where username = 'diego';
update public.profiles set display_name = 'Eli', favorite_genres = '{}', followers_count = 0, created_at = now() - interval '2 days' where username = 'eli.pixels';

-- ana has two published games, bruno one, carla one, eli one, and a draft; diego only a draft.
insert into public.games (id, owner_id, title, genre_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'A1', 'puzzle'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'A2', 'puzzle'),
  ('11111111-1111-1111-1111-111111111103', 'b0000000-0000-0000-0000-000000000002', 'B1', 'horror'),
  ('11111111-1111-1111-1111-111111111104', 'c0000000-0000-0000-0000-000000000003', 'C1', 'puzzle'),
  ('11111111-1111-1111-1111-111111111105', 'e0000000-0000-0000-0000-000000000005', 'E1', 'puzzle'),
  ('11111111-1111-1111-1111-111111111106', 'd0000000-0000-0000-0000-000000000004', 'D draft', 'puzzle');
insert into public.game_versions (id, game_id, number, label, status)
select ('22222222-2222-2222-2222-2222222222' || right(g.id::text, 2))::uuid, g.id, 1, 'v1', 'ready' from public.games g where g.title <> 'D draft';
update public.games g set active_version_id = v.id, status = 'published' from public.game_versions v where v.game_id = g.id;

select tests.authenticate_as_anon();

-- ------------------------------------------------------------------ who is listed, and the orders
select is(pg_temp.names(), 'eli.pixels,carla,bruno,ana', 'newest first, and diego (only a draft) is not a creator yet');
select is(pg_temp.names(p_sort => 'followers'), 'bruno,ana,carla,eli.pixels', 'most followed first');
select is(pg_temp.names(p_sort => 'games'), 'ana,bruno,carla,eli.pixels', 'most games first, ties by followers');
select is(pg_temp.names(p_sort => 'nonsense'), 'eli.pixels,carla,bruno,ana', 'an unknown order is the default one');

-- ------------------------------------------------------------------ filters
select is(pg_temp.names(p_genre => 'puzzle'), 'carla,ana', 'by favorite genre');
select is(pg_temp.names(p_genre => ''), 'eli.pixels,carla,bruno,ana', 'empty filters mean no filter');
select is(pg_temp.names(p_genre => 'x'' or ''1''=''1'), '', 'a hostile filter matches nothing and breaks nothing');

-- ------------------------------------------------------------------ text
select is(pg_temp.names('ana'), 'ana', 'by name');
select is(pg_temp.names('GOMEZ'), 'ana', 'ignoring accents and capitals');
select is(pg_temp.names('nandu'), 'bruno', 'an accented name found without the accent');
select is(pg_temp.names('ru'), 'carla', 'the start of a word of the name (Ruiz) matches, the middle of one (Bruno) does not');
select is(pg_temp.names('pixels'), 'eli.pixels', 'by a part of the @username');
select is(pg_temp.names('eli pix'), 'eli.pixels', 'several words, in any part of the name or the @username');
select is(pg_temp.names('carla gomez'), '', 'every word has to match');
select is(pg_temp.names('sin juegos'), '', 'a person with no published game is not found by text either');
select is(pg_temp.names('ana', p_genre => 'puzzle', p_sort => 'followers'), 'ana', 'text, filter and order together');
select lives_ok($$ select * from public.explore_creators('''; drop table public.profiles; --') $$, 'hostile text breaks nothing');
select lives_ok($$ select * from public.explore_creators('% _ \ & | ! ( ) :*') $$, 'nor do wildcards and search operators');
select is((select count(*) from public.explore_creators('%')), 4::bigint, 'a percent sign is not a wildcard (it is dropped: no words, so everyone)');

-- ------------------------------------------------------------------ pages and total
select is((select max(total) from public.explore_creators()), 4::bigint, 'the total counts the matches');
select is(pg_temp.names(p_limit => 2), 'eli.pixels,carla', 'the first page');
select is(pg_temp.names(p_limit => 2, p_offset => 2), 'bruno,ana', 'the second page');
select is((select max(total) from public.explore_creators(p_limit => 1, p_offset => 3)), 4::bigint, 'the total does not depend on the page');
select is((select count(*) from public.explore_creators(p_limit => 1000)), 4::bigint, 'a huge limit is clamped');
select is((select count(*) from public.explore_creators(p_offset => -5)), 4::bigint, 'a negative offset is zero');
select is((select count(*) from public.explore_creators(p_offset => 100)), 0::bigint, 'past the end is empty');

-- ------------------------------------------------------------------ what moderation hides
select tests.clear_authentication();
update public.games set status = 'hidden' where title in ('B1');
select tests.authenticate_as_anon();
select is(pg_temp.names(), 'eli.pixels,carla,ana', 'a creator whose only game was hidden is not listed');

select * from finish();
rollback;
