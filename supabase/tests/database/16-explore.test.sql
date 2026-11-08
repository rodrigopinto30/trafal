-- Exploring games: only published games, every filter, every order, the page and the total, hostile text, and no way to see who played.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

create function pg_temp.names(p_query text default null, p_genre text default null, p_engine text default null, p_mobile boolean default false, p_sort text default 'recent', p_limit integer default 24, p_offset integer default 0)
returns text language sql as $$
  select coalesce(string_agg(g.title, ',' order by r.ord), '')
  from (select e.id, row_number() over () as ord from public.explore_games(p_query, p_genre, p_engine, p_mobile, p_sort, p_limit, p_offset) e) r
  join public.games g on g.id = r.id
$$;

insert into public.games (id, owner_id, title, short_description, genre_id, engine_id, works_on_mobile) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Órbita', 'Gravedad y planetas', 'puzzle', 'phaser', true),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'Faro', 'Un faro en el mar', 'narrative', 'godot', false),
  ('11111111-1111-1111-1111-111111111103', 'b0000000-0000-0000-0000-000000000002', 'Kart', 'Autos de cartón', 'racing', 'phaser', true),
  ('11111111-1111-1111-1111-111111111104', 'b0000000-0000-0000-0000-000000000002', 'Borrador', 'Todavía no sale', 'puzzle', 'phaser', true);
insert into public.game_versions (id, game_id, number, label, status)
select ('22222222-2222-2222-2222-2222222222' || right(g.id::text, 2))::uuid, g.id, 1, 'v1', 'ready' from public.games g where g.title <> 'Borrador';
update public.games g set active_version_id = v.id, status = 'published' from public.game_versions v where v.game_id = g.id;
update public.games set published_at = now() - interval '3 days', play_count = 50, like_count = 2 where title = 'Órbita';
update public.games set published_at = now() - interval '2 days', play_count = 10, like_count = 9 where title = 'Faro';
update public.games set published_at = now() - interval '1 day', play_count = 30, like_count = 1 where title = 'Kart';

-- Trending: Faro was played twice this week, Kart once, Órbita only a long time ago.
insert into public.plays (game_id, version_id, user_id, session_id, started_at, device)
select g.id, v.id, null, gen_random_uuid(), now() - interval '1 day', 'desktop'
from public.games g join public.game_versions v on v.game_id = g.id where g.title in ('Faro', 'Faro', 'Kart');
insert into public.plays (game_id, version_id, user_id, session_id, started_at, device)
select g.id, v.id, null, gen_random_uuid(), now() - interval '2 days', 'mobile' from public.games g join public.game_versions v on v.game_id = g.id where g.title = 'Faro';
insert into public.plays (game_id, version_id, user_id, session_id, started_at, device)
select g.id, v.id, null, gen_random_uuid(), now() - interval '30 days', 'desktop' from public.games g join public.game_versions v on v.game_id = g.id where g.title = 'Órbita';

select tests.authenticate_as_anon();

-- ------------------------------------------------------------------ what is shown and in which order
select is(pg_temp.names(), 'Kart,Faro,Órbita', 'newest first by default, and no draft');
select is(pg_temp.names(p_sort => 'plays'), 'Órbita,Kart,Faro', 'most played first');
select is(pg_temp.names(p_sort => 'trending'), 'Faro,Kart,Órbita', 'trending counts the last 7 days only');
select is(pg_temp.names(p_sort => 'nonsense'), 'Kart,Faro,Órbita', 'an unknown order is the default one');
select is(pg_temp.names(p_sort => 'relevance'), 'Kart,Faro,Órbita', 'relevance without a text is the default order');

-- ------------------------------------------------------------------ filters
select is(pg_temp.names(p_genre => 'puzzle'), 'Órbita', 'by genre (the draft of that genre is not shown)');
select is(pg_temp.names(p_engine => 'phaser'), 'Kart,Órbita', 'by engine');
select is(pg_temp.names(p_mobile => true), 'Kart,Órbita', 'only games that work on mobile');
select is(pg_temp.names(p_genre => 'puzzle', p_engine => 'phaser', p_mobile => true), 'Órbita', 'all of them together');
select is(pg_temp.names(p_genre => 'terror'), '', 'a genre with no games gives an empty page');
select is(pg_temp.names(p_genre => '', p_engine => ''), 'Kart,Faro,Órbita', 'empty filters mean no filter');
select is(pg_temp.names(p_genre => 'puzzle'' or ''1''=''1'), '', 'a hostile filter matches nothing and breaks nothing');

-- ------------------------------------------------------------------ text
select is(pg_temp.names('orbita'), 'Órbita', 'text without accents finds the accented title');
select is(pg_temp.names('ORB'), 'Órbita', 'a prefix in capitals');
select is(pg_temp.names('faro mar'), 'Faro', 'every word has to match');
select is(pg_temp.names('autos', p_mobile => true), 'Kart', 'text and filters together');
select is(pg_temp.names('autos', p_engine => 'godot'), '', 'and they all have to match');
select is(pg_temp.names('Todavía'), '', 'a draft is never found by text');
select lives_ok($$ select * from public.explore_games('''; drop table public.games; --') $$, 'hostile text does not break the query');
select lives_ok($$ select * from public.explore_games('& | ! ( ) :* <->') $$, 'nor do search operators');
select is(pg_temp.names('faro', p_sort => 'relevance'), 'Faro', 'relevance with a text');

-- ------------------------------------------------------------------ pages and total
select is((select max(total) from public.explore_games()), 3::bigint, 'the total counts the matches, drafts excluded');
select is(pg_temp.names(p_limit => 2), 'Kart,Faro', 'the first page');
select is(pg_temp.names(p_limit => 2, p_offset => 2), 'Órbita', 'the second page');
select is((select max(total) from public.explore_games(p_limit => 1, p_offset => 2)), 3::bigint, 'the total does not depend on the page');
select is((select count(*) from public.explore_games(p_limit => 1000)), 3::bigint, 'a huge limit is clamped (there are only three)');
select is((select count(*) from public.explore_games(p_limit => 0)), 1::bigint, 'a zero limit still gives one');
select is((select count(*) from public.explore_games(p_offset => -5)), 3::bigint, 'a negative offset is zero');
select is((select count(*) from public.explore_games(p_offset => 100)), 0::bigint, 'past the end is empty');

-- ------------------------------------------------------------------ privacy
select throws_ok($$ select * from public.plays $$, '42501', null, 'the plays themselves stay unreadable');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'explore_games' and p.prosecdef), 1::bigint, 'the function is the definer one');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.names(), 'Kart,Faro,Órbita', 'signed-in people see the same, and not even their own drafts');

select * from finish();
rollback;
