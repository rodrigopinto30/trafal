-- «Me sirvió»: only the owner of the game or the update, only on other people's published top-level comments, never by
-- editing the comment, and the creator's questions with their answers.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');

insert into public.games (id, owner_id, title, genre_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Ana''s game', 'puzzle'),
  ('11111111-1111-1111-1111-111111111102', 'b0000000-0000-0000-0000-000000000002', 'Bruno''s game', 'puzzle');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v0.1', 'ready'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 1, 'v0.1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222202', status = 'published' where id = '11111111-1111-1111-1111-111111111102';
insert into public.game_questions (id, game_id, position, question) values
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111101', 1, 'Is the goal clear?'),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111101', 2, 'Was level 2 too hard?');
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555550', 'a0000000-0000-0000-0000-000000000001', 'avance', 'Ana''s update');
insert into public.comments (id, author_id, game_id, body, label) values
  ('66666666-6666-6666-6666-666666666601', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', 'Level 3 needs a checkpoint', 'suggestion'),
  ('66666666-6666-6666-6666-666666666604', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', 'Ana''s own comment', null);
insert into public.comments (id, author_id, post_id, body) values
  ('66666666-6666-6666-6666-666666666602', 'c0000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555550', 'Great progress');
insert into public.comments (id, author_id, game_id, parent_id, body) values
  ('66666666-6666-6666-6666-666666666603', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', '66666666-6666-6666-6666-666666666601', 'Thanks, noted'),
  ('66666666-6666-6666-6666-666666666605', 'c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '66666666-6666-6666-6666-666666666601', 'I agree with Bruno');
update public.comments set updated_at = '2020-01-01 00:00:00+00';

-- ------------------------------------------------------------------ the owner marks and unmarks
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', true) $$, 'the creator marks a comment on their game');
select is((select is_helpful from public.comments where id = '66666666-6666-6666-6666-666666666601'), true, 'it is marked');
select is((select updated_at from public.comments where id = '66666666-6666-6666-6666-666666666601'), '2020-01-01 00:00:00+00'::timestamptz, 'and marking it is not editing it');
select lives_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666602', true) $$, 'the author of an update marks a comment on it');
select lives_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', true) $$, 'marking twice is harmless');
select lives_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', false) $$, 'the mark can be taken off');
select is((select is_helpful from public.comments where id = '66666666-6666-6666-6666-666666666601'), false, 'it is not marked any more');

-- ------------------------------------------------------------------ what cannot be marked
select throws_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666604', true) $$, 'P0001', 'own_comment', 'nobody marks their own comment');
select throws_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666605', true) $$, 'P0001', 'reply_cannot_be_helpful', 'a reply cannot be marked');
select throws_ok($$ select public.set_comment_helpful(gen_random_uuid(), true) $$, 'P0001', 'comment_not_found', 'a comment that does not exist is not found');

-- ------------------------------------------------------------------ who cannot mark
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', true) $$, '42501', 'not_owner', 'the author of a comment cannot mark it (not the owner of the game)');
select throws_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666602', true) $$, '42501', 'not_owner', 'nor can the owner of another game mark a comment elsewhere');
select throws_ok($$ update public.comments set is_helpful = true where id = '66666666-6666-6666-6666-666666666601' $$, '42501', null, 'and a direct update never works');

select tests.authenticate_as_anon();
select throws_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', true) $$, '42501', null, 'anon cannot mark');

-- ------------------------------------------------------------------ what is hidden or suspended stays out of reach
select tests.clear_authentication();
update public.comments set status = 'hidden' where id = '66666666-6666-6666-6666-666666666602';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666602', false) $$, 'P0001', 'comment_not_found', 'a hidden comment cannot be marked');
select tests.clear_authentication();
update public.profile_private set status = 'suspended' where id = 'a0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.set_comment_helpful('66666666-6666-6666-6666-666666666601', true) $$, '42501', 'account_restricted', 'a suspended account cannot mark');
select tests.clear_authentication();
update public.profile_private set status = 'active' where id = 'a0000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------------------ editing a comment still moves its date
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ update public.comments set body = 'Level 3 really needs a checkpoint' where id = '66666666-6666-6666-6666-666666666601' $$, 'the author edits their comment');
select isnt((select updated_at from public.comments where id = '66666666-6666-6666-6666-666666666601'), '2020-01-01 00:00:00+00'::timestamptz, 'and that does move its date');

-- ------------------------------------------------------------------ the creator's questions and their answers
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select lives_ok($$ insert into public.comments (author_id, game_id, question_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '44444444-4444-4444-4444-444444444401', 'Yes, very clear') $$, 'carla answers the first question');
select throws_ok($$ insert into public.comments (author_id, game_id, question_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '44444444-4444-4444-4444-444444444401', 'A second answer') $$, '23505', null, 'only one answer per person and question');
select lives_ok($$ insert into public.comments (author_id, game_id, question_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '44444444-4444-4444-4444-444444444402', 'A bit') $$, 'but she can answer the other one');
select throws_ok($$ insert into public.comments (author_id, game_id, question_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111102', '44444444-4444-4444-4444-444444444401', 'wrong game') $$, 'P0001', 'question_mismatch', 'a question of another game cannot be answered here');
select lives_ok($$ update public.comments set body = 'Yes, crystal clear' where body = 'Yes, very clear' $$, 'she edits her answer');
select is(tests.dml_count($$ delete from public.comments where body = 'A bit' $$), 1::bigint, 'and deletes the other one');
select lives_ok($$ insert into public.comments (author_id, game_id, question_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '44444444-4444-4444-4444-444444444402', 'Changed my mind: too hard') $$, 'after deleting she can answer again');

select tests.authenticate_as_anon();
select is((select count(*) from public.game_questions where game_id = '11111111-1111-1111-1111-111111111101'), 2::bigint, 'anyone reads the questions of a published game');
select is((select count(*) from public.comments where question_id is not null), 2::bigint, 'and their answers');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(tests.dml_count($$ update public.game_questions set question = 'hacked question' $$), 0::bigint, 'only the creator edits the questions');
select is(tests.dml_count($$ delete from public.game_questions $$), 0::bigint, 'or deletes them');

select * from finish();
rollback;
