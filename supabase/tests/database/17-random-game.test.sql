-- «Sorprendeme»: a random PUBLISHED game, with the same chance for all, leaving out the one being looked at.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

select is(public.random_game(), null, 'with no games there is nothing to show');
insert into public.games (id, public_id, owner_id, title, genre_id, engine_id) values
  ('11111111-1111-1111-1111-111111111101', 'uno', 'a0000000-0000-0000-0000-000000000001', 'Uno', 'puzzle', 'phaser'),
  ('11111111-1111-1111-1111-111111111102', 'dos', 'a0000000-0000-0000-0000-000000000001', 'Dos', 'puzzle', 'phaser'),
  ('11111111-1111-1111-1111-111111111103', 'tres', 'b0000000-0000-0000-0000-000000000002', 'Tres', 'puzzle', 'phaser'),
  ('11111111-1111-1111-1111-111111111104', 'borrador', 'b0000000-0000-0000-0000-000000000002', 'Borrador', 'puzzle', 'phaser');
insert into public.game_versions (id, game_id, number, label, status)
select ('22222222-2222-2222-2222-2222222222' || right(g.id::text, 2))::uuid, g.id, 1, 'v1', 'ready' from public.games g where g.title <> 'Borrador';
update public.games g set active_version_id = v.id, status = 'published' from public.game_versions v where v.game_id = g.id;
update public.games set play_count = 100000 where public_id = 'uno';

select tests.authenticate_as_anon();

select is((select count(distinct public.random_game()) from generate_series(1, 300)), 3::bigint, 'every published game can come out, and only them');
select is((select count(*) from generate_series(1, 300) where public.random_game() = 'borrador'), 0::bigint, 'a draft never does');
select is((select count(*) from generate_series(1, 300) where public.random_game('uno') = 'uno'), 0::bigint, 'the game being looked at never comes back while there are others');
select is((select count(distinct public.random_game('uno')) from generate_series(1, 300)), 2::bigint, 'and the rest still come out');
select is((select count(*) from generate_series(1, 300) where public.random_game('no-existe') is null), 0::bigint, 'an unknown game to leave out changes nothing');
select is((select count(*) from generate_series(1, 300) where public.random_game('borrador') is null), 0::bigint, 'leaving out a draft changes nothing');
select ok((select count(*) from generate_series(1, 600) where public.random_game() = 'uno') between 120 and 280, 'the most played game gets no more chances than the others (about a third)');
select lives_ok($$ select public.random_game('''; drop table public.games; --') $$, 'hostile text to leave out breaks nothing');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from generate_series(1, 300) where public.random_game() = 'borrador'), 0::bigint, 'not even their own draft is offered to its creator');

select tests.clear_authentication();
update public.games set status = 'hidden' where public_id in ('dos', 'tres');
select tests.authenticate_as_anon();
select is((select count(distinct public.random_game('uno')) from generate_series(1, 50)), 1::bigint, 'if the one being looked at is the only published game, it comes back');
select tests.clear_authentication();
update public.games set status = 'hidden';
select tests.authenticate_as_anon();
select is(public.random_game('uno'), null, 'and with none published there is nothing');

select * from finish();
rollback;
