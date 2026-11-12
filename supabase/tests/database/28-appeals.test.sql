-- Appeals: only the person a decision was taken about can appeal it (even suspended), once per decision, nobody writes the table
-- directly, only an admin resolves, overturning really reverses the decision, and everything leaves a line in the moderation log and
-- tells the person.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

insert into public.games (id, owner_id, title, short_description, genre_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Ana''s game', 'A nice game', 'puzzle'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'Ana''s other game', 'Another', 'puzzle');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v1', 'ready'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 1, 'v1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222202', status = 'published' where id = '11111111-1111-1111-1111-111111111102';
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000001', 'avance', 'An update of ana');
insert into public.comments (id, author_id, game_id, body) values
  ('66666666-6666-6666-6666-666666666601', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', 'A comment of bruno');

select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'hide', 'Breaks the rules');
select public.moderate_content('post', '55555555-5555-5555-5555-555555555501', 'hide', 'Spam');
select public.moderate_content('comment', '66666666-6666-6666-6666-666666666601', 'hide', 'Rude');
select public.suspend_account('b0000000-0000-0000-0000-000000000002', 'Repeated insults', null);
select tests.clear_authentication();

-- ------------------------------------------------------------------ who can appeal what
select tests.authenticate_as_anon();
select throws_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111101', 'Please look again') $$, '42501', null, 'a visitor cannot appeal');

select tests.authenticate_as_anon();
select throws_ok($$ select * from public.my_decisions() $$, '42501', null, 'nor read the decisions');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(
  (select string_agg(target_type || ':' || label || ':' || reason || ':' || coalesce(appeal_status, 'none'), ', ' order by target_type) from public.my_decisions()),
  'game:Ana''s game:Breaks the rules:none, post:An update of ana:Spam:none',
  'ana sees what was decided about her: the game and the update, with the reasons and no appeal yet'
);
select is((select count(*) from public.my_decisions() where target_type = 'comment'), 0::bigint, 'and not the comment of bruno');
select throws_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111101', '   ') $$, 'P0001', 'message_required', 'the appeal needs a message');
select throws_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111101', repeat('x', 1001)) $$, 'P0001', 'message_required', 'not longer than 1000');
select throws_ok($$ select public.submit_appeal('report', '11111111-1111-1111-1111-111111111101', 'Please') $$, 'P0001', 'invalid_target_type', 'only what can be moderated is appealable');
select throws_ok($$ select public.submit_appeal('comment', '66666666-6666-6666-6666-666666666601', 'Not mine') $$, 'P0001', 'nothing_to_appeal', 'nobody appeals what is somebody else''s');
select throws_ok($$ select public.submit_appeal('game', '99999999-9999-9999-9999-999999999999', 'Nothing') $$, 'P0001', 'nothing_to_appeal', 'and a missing target looks the same, so nothing is probed');
select throws_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111102', 'It is fine') $$, 'P0001', 'nothing_to_appeal', 'what is published has nothing to appeal');
select throws_ok($$ select public.submit_appeal('profile', 'a0000000-0000-0000-0000-000000000001', 'I am fine') $$, 'P0001', 'nothing_to_appeal', 'neither does an account that is not suspended');
select throws_ok($$ select public.submit_appeal('profile', 'b0000000-0000-0000-0000-000000000002', 'Appeal for bruno') $$, 'P0001', 'nothing_to_appeal', 'nobody appeals the suspension of somebody else');

select lives_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111101', '  It is my own work  ') $$, 'ana appeals the hidden game');
select is(
  (select status || '|' || target_label || '|' || decision_reason || '|' || message from public.appeals where target_id = '11111111-1111-1111-1111-111111111101'),
  'open|Ana''s game|Breaks the rules|It is my own work',
  'it is open and keeps what was decided and why (message trimmed)'
);
select throws_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111101', 'Again') $$, 'P0001', 'already_appealed', 'a second one while the first is open is refused');
select is((select appeal_status from public.my_decisions() where target_type = 'game'), 'open', 'and the decision shows its appeal as open');
select lives_ok($$ select public.submit_appeal('post', '55555555-5555-5555-5555-555555555501', 'The update is fine') $$, 'she appeals the hidden update too');

select throws_ok($$ insert into public.appeals (appellant_id, target_type, target_id, message) values ('a0000000-0000-0000-0000-000000000001', 'game', '11111111-1111-1111-1111-111111111102', 'x') $$, '42501', null, 'nobody inserts appeals directly');
select throws_ok($$ update public.appeals set status = 'overturned' $$, '42501', null, 'nor changes them');
select throws_ok($$ delete from public.appeals $$, '42501', null, 'nor deletes them');

select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select is((select count(*) from public.appeals), 0::bigint, 'carla sees no appeals');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.appeals), 0::bigint, 'bruno does not see ana''s');

-- ------------------------------------------------------------------ a suspended account can appeal (it cannot write anything else)
select throws_ok($$ insert into public.comments (author_id, game_id, body) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111102', 'x') $$, '42501', null, 'bruno is suspended: he cannot comment');
select lives_ok($$ select public.submit_appeal('profile', 'b0000000-0000-0000-0000-000000000002', 'I apologise') $$, 'but he can appeal the suspension');
select is((select decision_reason from public.appeals where target_type = 'profile'), 'Repeated insults', 'which keeps the reason of the suspension');
select throws_ok($$ select public.submit_appeal('profile', 'b0000000-0000-0000-0000-000000000002', 'Again') $$, 'P0001', 'already_appealed', 'once while it is open');
select lives_ok($$ select public.submit_appeal('comment', '66666666-6666-6666-6666-666666666601', 'The comment was fair') $$, 'and his hidden comment');

select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.appeals), 4::bigint, 'the admin sees all of them');

-- ------------------------------------------------------------------ resolving
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'game'), 'overturned', 'Fine') $$, '42501', null, 'a person cannot resolve their own appeal');

select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'game'), 'maybe', 'Hmm') $$, 'P0001', 'invalid_outcome', 'the outcome is upheld or overturned');
select throws_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'game'), 'upheld', '  ') $$, 'P0001', 'reason_required', 'the answer needs a note');
select throws_ok($$ select public.resolve_appeal('99999999-9999-9999-9999-999999999999', 'upheld', 'No') $$, 'P0001', 'appeal_not_found', 'an unknown appeal');

select lives_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'game'), 'upheld', 'The rules were broken') $$, 'the admin keeps the decision on the game');
select is((select status from public.games where id = '11111111-1111-1111-1111-111111111101'), 'hidden', 'the game stays hidden');
select is((select status || '|' || resolution_note || '|' || (resolved_at is not null)::text from public.appeals where target_type = 'game'), 'upheld|The rules were broken|true', 'the appeal records the answer');
select is((select action || '|' || admin_username || '|' || target_type || '|' || coalesce(reason, '') from public.moderation_log where target_type = 'appeal' order by id desc limit 1), 'resolve_appeal|admina|appeal|upheld: The rules were broken', 'and the log says who answered what');
select throws_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'game'), 'overturned', 'Changed my mind') $$, 'P0001', 'appeal_already_resolved', 'an appeal is resolved once');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(
  (select data ->> 'action' || '|' || (data ->> 'target_type') || '|' || (data ->> 'note') from public.notifications where type = 'moderation' and game_id = '11111111-1111-1111-1111-111111111101' and data ->> 'action' like 'appeal_%'),
  'appeal_upheld|game|The rules were broken',
  'ana is told, with the answer'
);
select is((select actor_id from public.notifications where type = 'moderation' and data ->> 'action' = 'appeal_upheld'), null, 'without saying which admin answered');
select throws_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111101', 'One more time') $$, 'P0001', 'already_appealed', 'the same decision cannot be appealed twice');

select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'post'), 'overturned', 'It was not spam') $$, 'the admin overturns the decision on the update');
select is((select status from public.posts where id = '55555555-5555-5555-5555-555555555501'), 'published', 'the update is published again');
select is((select action || '|' || coalesce(reason, '') from public.moderation_log where target_type = 'post' order by id desc limit 1), 'restore_post|Appeal: It was not spam', 'the log has the restore, said to come from an appeal');

select lives_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'comment'), 'overturned', 'Fair comment') $$, 'and on the comment');
select is((select status from public.comments where id = '66666666-6666-6666-6666-666666666601'), 'published', 'the comment is back');

select lives_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'profile'), 'overturned', 'Apology accepted') $$, 'and on the suspension');
select is((select status || '|' || coalesce(suspension_reason, 'null') from public.profile_private where id = 'b0000000-0000-0000-0000-000000000002'), 'active|null', 'the account is active again');
select is((select action from public.moderation_log where target_type = 'profile' order by id desc limit 1), 'lift_suspension', 'the log has the lifting');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(
  (select count(*) from public.notifications where type = 'moderation' and data ->> 'action' = 'appeal_overturned'),
  2::bigint,
  'bruno is told about the account and about the comment'
);
select lives_ok($$ insert into public.comments (author_id, game_id, body) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111102', 'I can comment again') $$, 'and he can write again');

-- ------------------------------------------------------------------ a new decision can be appealed again
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select public.moderate_content('post', '55555555-5555-5555-5555-555555555501', 'hide', 'Hidden once more');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.submit_appeal('post', '55555555-5555-5555-5555-555555555501', 'Again, but it is a new decision') $$, 'a new decision on the same update opens the way to a new appeal');

-- ------------------------------------------------------------------ overturning something already reversed
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select public.moderate_content('post', '55555555-5555-5555-5555-555555555501', 'restore', 'Restored by report review');
select lives_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'post' and status = 'open'), 'overturned', 'Already restored') $$, 'resolving an appeal about something already restored still works');
select is((select status from public.posts where id = '55555555-5555-5555-5555-555555555501'), 'published', 'and changes nothing');
select is((select action || '|' || coalesce(reason, '') from public.moderation_log where target_type = 'post' order by id desc limit 1), 'restore_post|Restored by report review', 'and logs no restore that did not happen');

-- ------------------------------------------------------------------ the limit of open appeals
select tests.clear_authentication();
insert into public.games (id, owner_id, title, short_description, genre_id)
select ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid, 'c0000000-0000-0000-0000-000000000003', 'Carla ' || n, 'x', 'puzzle' from generate_series(1, 6) n;
update public.games set status = 'hidden' where owner_id = 'c0000000-0000-0000-0000-000000000003';
insert into public.moderation_log (admin_id, admin_username, action, target_type, target_id, reason)
select 'd0000000-0000-0000-0000-0000000000ad', 'admina', 'hide_game', 'game', id, 'Test' from public.games where owner_id = 'c0000000-0000-0000-0000-000000000003';
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.submit_appeal('game', ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid, 'Please') from generate_series(1, 5) n $$, 'carla opens five appeals');
select throws_ok($$ select public.submit_appeal('game', 'aaaaaaaa-0000-0000-0000-000000000006', 'Please') $$, 'P0001', 'too_many_open', 'and not a sixth while those are open');

select * from finish();
rollback;
