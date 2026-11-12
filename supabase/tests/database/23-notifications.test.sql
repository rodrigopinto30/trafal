-- What the bell tells each person: created by triggers with the event, never for one's own actions, once per person for likes and
-- follows and once per comment for «helpful», and each person only sees, marks and dismisses their own.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');

insert into public.games (id, owner_id, title, genre_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Ana''s game', 'puzzle');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v1', 'ready'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 2, 'v2', 'uploading'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 3, 'v3', 'processing');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000001', 'avance', 'An update of ana');
delete from public.notifications;

create function pg_temp.notes(p_user uuid, p_type text) returns bigint language sql as $$
  select count(*) from public.notifications where user_id = p_user and type = p_type
$$;

-- ------------------------------------------------------------------ comments and replies (inserted as the system: who may write is tested elsewhere)
select lives_ok($$ insert into public.comments (id, author_id, game_id, body) values ('66666666-6666-6666-6666-666666666601', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', 'Nice game') $$, 'bruno comments on ana''s game');
select is(pg_temp.notes('a0000000-0000-0000-0000-000000000001', 'comment'), 1::bigint, 'ana is told');
select is((select actor_id::text || '|' || game_id::text || '|' || comment_id::text from public.notifications where type = 'comment'), 'b0000000-0000-0000-0000-000000000002|11111111-1111-1111-1111-111111111101|66666666-6666-6666-6666-666666666601', 'with who, where and which comment');
select is((select count(*) from public.notifications where user_id = 'b0000000-0000-0000-0000-000000000002'), 0::bigint, 'and bruno is told nothing about his own comment');

select lives_ok($$ insert into public.comments (id, author_id, game_id, body) values ('66666666-6666-6666-6666-666666666602', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', 'Thanks!') $$, 'ana comments on her own game');
select lives_ok($$ insert into public.comments (id, author_id, game_id, parent_id, body) values ('66666666-6666-6666-6666-666666666603', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', '66666666-6666-6666-6666-666666666601', 'Glad you liked it') $$, 'and replies to bruno');
select is(pg_temp.notes('a0000000-0000-0000-0000-000000000001', 'comment'), 1::bigint, 'nobody is told about their own comments (ana still has just bruno''s)');
select is(pg_temp.notes('b0000000-0000-0000-0000-000000000002', 'reply'), 1::bigint, 'bruno is told about the reply');
select is((select count(*) from public.notifications where user_id = 'b0000000-0000-0000-0000-000000000002' and type = 'comment'), 0::bigint, 'as a reply, not as a comment');

select lives_ok($$ insert into public.comments (id, author_id, game_id, parent_id, body) values ('66666666-6666-6666-6666-666666666604', 'c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '66666666-6666-6666-6666-666666666601', 'Me too') $$, 'carla replies to bruno''s comment on ana''s game');
select is(pg_temp.notes('b0000000-0000-0000-0000-000000000002', 'reply'), 2::bigint, 'bruno is told');
select is(pg_temp.notes('a0000000-0000-0000-0000-000000000001', 'comment'), 2::bigint, 'and ana too, because it happens in her game');

select lives_ok($$ insert into public.comments (id, author_id, game_id, parent_id, body) values ('66666666-6666-6666-6666-666666666605', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', '66666666-6666-6666-6666-666666666602', 'You are welcome') $$, 'bruno replies to ana''s own comment');
select is(pg_temp.notes('a0000000-0000-0000-0000-000000000001', 'reply'), 1::bigint, 'ana is told once, as a reply');
select is(pg_temp.notes('a0000000-0000-0000-0000-000000000001', 'comment'), 2::bigint, 'not twice (reply and comment)');

insert into public.comments (id, author_id, post_id, body) values ('66666666-6666-6666-6666-666666666606', 'b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555501', 'On the update');
select is((select post_id::text from public.notifications where comment_id = '66666666-6666-6666-6666-666666666606'), '55555555-5555-5555-5555-555555555501', 'a comment on an update points to the update');

-- ------------------------------------------------------------------ likes and follows
delete from public.notifications;
insert into public.game_likes (user_id, game_id) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101');
insert into public.post_likes (user_id, post_id) values ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555501');
delete from public.game_likes where user_id = 'b0000000-0000-0000-0000-000000000002';
insert into public.game_likes (user_id, game_id) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101');
insert into public.follows (follower_id, followee_id) values ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001');
delete from public.follows where follower_id = 'b0000000-0000-0000-0000-000000000002';
insert into public.follows (follower_id, followee_id) values ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001');
insert into public.game_likes (user_id, game_id) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101');
select is((select count(*) from public.notifications where type = 'like' and game_id is not null), 1::bigint, 'liking a game, taking it back and liking it again tells the creator once');
select is((select count(*) from public.notifications where type = 'like' and post_id is not null), 1::bigint, 'and the same for an update');
select is((select count(*) from public.notifications where type = 'follow'), 1::bigint, 'following, unfollowing and following again tells once');
select is((select count(*) from public.notifications where actor_id = 'a0000000-0000-0000-0000-000000000001' and type = 'like'), 0::bigint, 'liking your own game tells nobody');

-- ------------------------------------------------------------------ helpful
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', true) $$, 'ana marks bruno''s comment as helpful');
select lives_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', false) $$, 'unmarks it');
select lives_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', true) $$, 'and marks it again');
select tests.clear_authentication();
select is((select count(*) from public.notifications where type = 'helpful' and user_id = 'b0000000-0000-0000-0000-000000000002' and actor_id = 'a0000000-0000-0000-0000-000000000001'), 1::bigint, 'bruno is told once');

-- ------------------------------------------------------------------ versions
delete from public.notifications;
update public.game_versions set status = 'processing' where id = '22222222-2222-2222-2222-222222222202';
select is((select count(*) from public.notifications), 0::bigint, 'going to processing tells nobody');
update public.game_versions set status = 'ready' where id = '22222222-2222-2222-2222-222222222202';
select is((select version_id::text || '|' || game_id::text from public.notifications where type = 'version_ready' and user_id = 'a0000000-0000-0000-0000-000000000001'), '22222222-2222-2222-2222-222222222202|11111111-1111-1111-1111-111111111101', 'a version that is ready tells its creator, with which');
update public.game_versions set error_code = 'ZIP_TOO_LARGE', status = 'error' where id = '22222222-2222-2222-2222-222222222203';
select is((select data ->> 'error_code' from public.notifications where type = 'version_error'), 'ZIP_TOO_LARGE', 'a rejected one too, with the reason code');
update public.game_versions set label = 'v2 renamed' where id = '22222222-2222-2222-2222-222222222202';
select is((select count(*) from public.notifications), 2::bigint, 'changing something else tells nobody');

-- ------------------------------------------------------------------ who can do what with them
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.notifications), 0::bigint, 'bruno does not see ana''s notifications');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.notifications where read_at is null), 2::bigint, 'ana sees hers, unread');
select is(tests.dml_count($$ update public.notifications set read_at = now() where read_at is null $$), 2::bigint, 'and marks them all as read in one go');
select is((select count(*) from public.notifications where read_at is null), 0::bigint, 'none is left');
select is((select count(*) from public.notifications where seen_at is null), 2::bigint, 'reading does not see them by itself: the bell counts seen_at');
select is(tests.dml_count($$ update public.notifications set seen_at = now() where seen_at is null $$), 2::bigint, 'ana sees them all when she opens the bell');
select is(tests.dml_count($$ update public.notifications set read_at = null $$), 2::bigint, 'and can mark them as unread again');
select is((select count(*) from public.notifications where read_at is null and seen_at is not null), 2::bigint, 'seen and unread: not counted on the bell, still highlighted in the list');
select throws_ok($$ update public.notifications set type = 'follow' $$, '42501', null, 'seen_at and read_at are the only columns that change');
select throws_ok($$ insert into public.notifications (user_id, type) values ('a0000000-0000-0000-0000-000000000001', 'like') $$, '42501', null, 'nobody invents notifications');
select is(tests.dml_count($$ delete from public.notifications $$), 2::bigint, 'ana dismisses hers');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(tests.dml_count($$ delete from public.notifications $$), 0::bigint, 'and bruno cannot dismiss anyone else''s (he has none)');

select * from finish();
rollback;
