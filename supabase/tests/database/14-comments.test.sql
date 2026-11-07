-- Comments written, edited and answered from the interface: only your own, only while published, replies only to published
-- comments, labels only on top-level ones, and the counters follow.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');

insert into public.games (id, owner_id, title, genre_id, engine_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Published', 'puzzle', 'phaser'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'Draft', 'puzzle', 'phaser');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v0.1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555540', 'a0000000-0000-0000-0000-000000000001', 'avance', 'An update');

insert into public.comments (id, author_id, game_id, body, label) values
  ('66666666-6666-6666-6666-666666666601', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', 'Loved the music', 'liked');
insert into public.comments (id, author_id, post_id, body) values
  ('66666666-6666-6666-6666-666666666602', 'b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555540', 'Nice progress');

-- ------------------------------------------------------------------ writing
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ insert into public.comments (author_id, game_id, body, label) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', '  Padded text  ', 'suggestion') $$, 'bruno comments on a game with a label');
select is((select count(*) from public.comments where body = 'Padded text'), 1::bigint, 'the text is trimmed');
select lives_ok($$ insert into public.comments (author_id, post_id, body) values ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555540', 'Another one') $$, 'and on an update, without a label');
select throws_ok($$ insert into public.comments (author_id, game_id, body) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', '   ') $$, '23514', null, 'an empty comment is refused');
select throws_ok($$ insert into public.comments (author_id, game_id, body) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', repeat('x', 1001)) $$, '23514', null, 'and so is one over 1000 characters');
select lives_ok($$ insert into public.comments (author_id, game_id, body) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', repeat('x', 1000)) $$, 'exactly 1000 is fine');
select throws_ok($$ insert into public.comments (author_id, game_id, body) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111102', 'on a draft of someone else') $$, '42501', null, 'nobody comments on a draft that is not theirs');
select is((select comment_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 3, 'the game counts its comments');
select is((select comment_count from public.posts where id = '55555555-5555-5555-5555-555555555540'), 2, 'and the update counts its own');

-- ------------------------------------------------------------------ replies
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.comments (author_id, game_id, parent_id, body) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', '66666666-6666-6666-6666-666666666601', 'Thanks!') $$, 'the creator replies');
select throws_ok($$ insert into public.comments (author_id, game_id, parent_id, body) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', (select id from public.comments where body = 'Thanks!'), 'a reply to a reply') $$, 'P0001', 'reply_depth_exceeded', 'there is only one level of replies');
select throws_ok($$ insert into public.comments (author_id, post_id, parent_id, body) values ('a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555540', '66666666-6666-6666-6666-666666666601', 'wrong place') $$, 'P0001', 'parent_target_mismatch', 'a reply stays on the same game or update');
select throws_ok($$ insert into public.comments (author_id, game_id, parent_id, body, label) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', '66666666-6666-6666-6666-666666666601', 'labelled reply', 'liked') $$, 'P0001', 'reply_cannot_have_label', 'a reply carries no label');
select throws_ok($$ update public.comments set label = 'liked' where body = 'Thanks!' $$, 'P0001', 'reply_cannot_have_label', 'nor can it get one by editing');
select throws_ok($$ insert into public.comments (author_id, game_id, parent_id, body) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', gen_random_uuid(), 'to nobody') $$, 'P0001', 'parent_not_found', 'a reply needs an existing comment');

-- ------------------------------------------------------------------ editing and deleting
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ update public.comments set body = 'Loved the music and the art', label = 'suggestion' where id = '66666666-6666-6666-6666-666666666601' $$, 'the author edits the text and the label');
select is((select label from public.comments where id = '66666666-6666-6666-6666-666666666601'), 'suggestion', 'both changed');
select throws_ok($$ update public.comments set label = 'meh' where id = '66666666-6666-6666-6666-666666666601' $$, '23514', null, 'an unknown label is refused');
select lives_ok($$ update public.comments set label = null where id = '66666666-6666-6666-6666-666666666601' $$, 'the label can be taken off');
select throws_ok($$ update public.comments set author_id = 'c0000000-0000-0000-0000-000000000003' where id = '66666666-6666-6666-6666-666666666601' $$, '42501', null, 'the author cannot be changed');
select throws_ok($$ update public.comments set game_id = null, post_id = '55555555-5555-5555-5555-555555555540' where id = '66666666-6666-6666-6666-666666666601' $$, '42501', null, 'a comment cannot be moved to another target');
select throws_ok($$ update public.comments set status = 'hidden' where id = '66666666-6666-6666-6666-666666666601' $$, '42501', null, 'the author cannot hide or restore their own comment');
select throws_ok($$ update public.comments set is_helpful = true where id = '66666666-6666-6666-6666-666666666602' $$, '42501', null, 'nobody marks their own comment as helpful');

select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select is(tests.dml_count($$ update public.comments set body = 'hacked' $$), 0::bigint, 'carla edits nobody else''s comments');
select is(tests.dml_count($$ delete from public.comments $$), 0::bigint, 'nor deletes them');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(tests.dml_count($$ delete from public.comments where id = '66666666-6666-6666-6666-666666666602' $$), 1::bigint, 'the author deletes their own comment');
select is((select comment_count from public.posts where id = '55555555-5555-5555-5555-555555555540'), 1, 'and the update''s counter goes down');

-- ------------------------------------------------------------------ what moderation hides stays hidden
select tests.clear_authentication();
update public.comments set status = 'hidden' where id = '66666666-6666-6666-6666-666666666601';
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(tests.dml_count($$ update public.comments set body = 'trying to change what was moderated' where id = '66666666-6666-6666-6666-666666666601' $$), 0::bigint, 'the author cannot edit a hidden comment');
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select throws_ok($$ insert into public.comments (author_id, game_id, parent_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '66666666-6666-6666-6666-666666666601', 'answering a hidden comment') $$, 'P0001', 'parent_not_found', 'and nobody can answer it');
select tests.authenticate_as_anon();
select is((select count(*) from public.comments where id = '66666666-6666-6666-6666-666666666601'), 0::bigint, 'visitors do not see it');
select throws_ok($$ insert into public.comments (author_id, game_id, body) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', 'anonymous') $$, '42501', null, 'and cannot comment');

-- ------------------------------------------------------------------ a suspended account cannot write
select tests.clear_authentication();
update public.profile_private set status = 'suspended' where id = 'c0000000-0000-0000-0000-000000000003';
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select throws_ok($$ insert into public.comments (author_id, game_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', 'while suspended') $$, '42501', null, 'a suspended account cannot comment');

select * from finish();
rollback;
