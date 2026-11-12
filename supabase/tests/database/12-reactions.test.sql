-- Likes and saves on games and posts: only your own marks, only on content you can see, counters that follow, nothing from anon.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');

insert into public.games (id, owner_id, title, genre_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Published', 'puzzle'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'Draft', 'puzzle'),
  ('11111111-1111-1111-1111-111111111103', 'a0000000-0000-0000-0000-000000000001', 'Hidden later', 'puzzle');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v0.1', 'ready'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103', 1, 'v0.1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222203', status = 'published' where id = '11111111-1111-1111-1111-111111111103';
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555510', 'a0000000-0000-0000-0000-000000000001', 'avance', 'A visible update');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');

-- ------------------------------------------------------------------ marks on content you can see
select lives_ok($$ insert into public.game_likes (user_id, game_id) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101') $$, 'bruno likes a published game');
select lives_ok($$ insert into public.game_saves (user_id, game_id) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101') $$, 'and saves it');
select lives_ok($$ insert into public.post_likes (user_id, post_id) values ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555510') $$, 'likes an update');
select lives_ok($$ insert into public.post_saves (user_id, post_id) values ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555510') $$, 'and saves it');
select is((select like_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 1, 'the game counts one like');
select is((select save_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 1, 'and one save');
select is((select like_count || '/' || save_count from public.posts where id = '55555555-5555-5555-5555-555555555510'), '1/1', 'the update counts one like and one save');

-- ------------------------------------------------------------------ a second person adds to the counters, never to the first one's marks
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select lives_ok($$ insert into public.game_likes (user_id, game_id) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101') $$, 'carla likes the same game');
select is((select like_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 2, 'two likes');
select is((select count(*) from public.game_likes), 1::bigint, 'carla only sees her own like');
select is((select count(*) from public.game_saves) + (select count(*) from public.post_likes) + (select count(*) from public.post_saves), 0::bigint, 'and none of bruno''s other marks');
select is(tests.dml_count($$ delete from public.game_likes where user_id = 'b0000000-0000-0000-0000-000000000002' $$), 0::bigint, 'carla cannot remove bruno''s like');
select is(tests.dml_count($$ delete from public.post_saves where user_id = 'b0000000-0000-0000-0000-000000000002' $$), 0::bigint, 'nor his save');
select is((select like_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 2, 'the counter did not move');
select throws_ok($$ insert into public.post_saves (user_id, post_id) values ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555510') $$, '42501', null, 'carla cannot save in bruno''s name either');

-- ------------------------------------------------------------------ unpublished content cannot be marked by others
select throws_ok($$ insert into public.game_likes (user_id, game_id) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111102') $$, '42501', null, 'a draft of someone else cannot be liked');
select throws_ok($$ insert into public.game_saves (user_id, game_id) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111102') $$, '42501', null, 'nor saved');
select throws_ok($$ insert into public.game_likes (user_id, game_id) values ('c0000000-0000-0000-0000-000000000003', gen_random_uuid()) $$, '42501', null, 'a game that does not exist cannot be liked');

-- ------------------------------------------------------------------ taking marks off
select is(tests.dml_count($$ delete from public.game_likes where user_id = 'c0000000-0000-0000-0000-000000000003' $$), 1::bigint, 'carla takes her like off');
select is((select like_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 1, 'the counter goes down');
select is(tests.dml_count($$ delete from public.game_likes where user_id = 'c0000000-0000-0000-0000-000000000003' $$), 0::bigint, 'taking it off again removes nothing');
select is((select like_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 1, 'and the counter does not go below the real number');

-- ------------------------------------------------------------------ marks are only inserted with the allowed columns
select throws_ok($$ insert into public.game_likes (user_id, game_id, created_at) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', now() - interval '1 year') $$, '42501', null, 'the date of a mark cannot be chosen');
select throws_ok($$ update public.game_likes set game_id = '11111111-1111-1111-1111-111111111103' $$, '42501', null, 'a mark cannot be moved to another game');

-- ------------------------------------------------------------------ the owner can mark their own game, and visitors never can
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.game_saves (user_id, game_id) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111102') $$, 'ana can save her own draft');
select tests.authenticate_as_anon();
select throws_ok($$ insert into public.game_saves (user_id, game_id) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101') $$, '42501', null, 'anon cannot save');
select throws_ok($$ insert into public.post_likes (user_id, post_id) values ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555510') $$, '42501', null, 'anon cannot like an update');
select throws_ok($$ select * from public.game_saves $$, '42501', null, 'anon cannot read saves');
select is((select like_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 1, 'but anyone can read the public counter');

-- ------------------------------------------------------------------ a hidden game is no longer markable, and its marks stay private
select tests.clear_authentication();
update public.games set status = 'hidden' where id = '11111111-1111-1111-1111-111111111103';
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select throws_ok($$ insert into public.game_likes (user_id, game_id) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111103') $$, '42501', null, 'a game hidden by moderation cannot be liked');

select * from finish();
rollback;
