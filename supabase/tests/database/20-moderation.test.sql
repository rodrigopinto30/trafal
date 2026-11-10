-- Moderation by admins: only through audited functions, only hiding and restoring (never editing or deleting), every action in the
-- append-only log, the author told with the reason, and reports that go through their states once.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

insert into public.games (id, owner_id, title, short_description, genre_id, engine_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Ana''s game', 'A nice game', 'puzzle', 'phaser'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'Ana''s draft', 'x', 'puzzle', 'phaser');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555560', 'a0000000-0000-0000-0000-000000000001', 'avance', 'An update');
insert into public.comments (id, author_id, game_id, body) values
  ('66666666-6666-6666-6666-666666666610', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', 'A rude comment');
insert into public.reports (id, reporter_id, target_type, target_id, reason, detail) values
  ('77777777-7777-7777-7777-777777777701', 'b0000000-0000-0000-0000-000000000002', 'game', '11111111-1111-1111-1111-111111111101', 'spam', 'Looks like spam'),
  ('77777777-7777-7777-7777-777777777702', 'a0000000-0000-0000-0000-000000000001', 'comment', '66666666-6666-6666-6666-666666666610', 'abuse', 'Insulting'),
  ('77777777-7777-7777-7777-777777777703', 'a0000000-0000-0000-0000-000000000001', 'profile', 'b0000000-0000-0000-0000-000000000002', 'other', ''),
  ('77777777-7777-7777-7777-777777777704', 'b0000000-0000-0000-0000-000000000002', 'post', '55555555-5555-5555-5555-555555555560', 'spam', '');

create function pg_temp.logged() returns bigint language sql as $$ select count(*) from public.moderation_log where created_at = now() $$;
create function pg_temp.last_log() returns text language sql as $$
  select action || '|' || admin_username || '|' || target_type || '|' || target_id::text || '|' || coalesce(reason, 'null') from public.moderation_log order by id desc limit 1
$$;

-- ------------------------------------------------------------------ hiding and restoring
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'hide', '  Breaks the rules  ') $$, 'the admin hides a game');
select is((select status from public.games where id = '11111111-1111-1111-1111-111111111101'), 'hidden', 'it is hidden');
select is(pg_temp.last_log(), 'hide_game|admina|game|11111111-1111-1111-1111-111111111101|Breaks the rules', 'the log says who, what, which game and why (reason trimmed)');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select data ->> 'reason' || '|' || (data ->> 'action') || '|' || (data ->> 'target_type') from public.notifications where game_id = '11111111-1111-1111-1111-111111111101'), 'Breaks the rules|hide|game', 'the creator is told, with the reason');
select is((select actor_id from public.notifications where game_id = '11111111-1111-1111-1111-111111111101'), null, 'without saying which admin acted');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'restore', 'Reviewed again, it is fine') $$, 'the game can be restored');
select is((select status from public.games where id = '11111111-1111-1111-1111-111111111101'), 'published', 'and is published again');
select is(pg_temp.last_log(), 'restore_game|admina|game|11111111-1111-1111-1111-111111111101|Reviewed again, it is fine', 'the restoration is logged too');

select lives_ok($$ select public.moderate_content('post', '55555555-5555-5555-5555-555555555560', 'hide', 'Spam') $$, 'an update can be hidden');
select is((select status from public.posts where id = '55555555-5555-5555-5555-555555555560'), 'hidden', 'and it is');
select lives_ok($$ select public.moderate_content('comment', '66666666-6666-6666-6666-666666666610', 'hide', 'Insults') $$, 'a comment can be hidden');
select is((select comment_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 0, 'and the counter of the game goes down');
select lives_ok($$ select public.moderate_content('comment', '66666666-6666-6666-6666-666666666610', 'restore', 'Context made it fine') $$, 'and restored');
select is((select comment_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 1, 'with the counter back up');

-- ------------------------------------------------------------------ what it refuses
select throws_ok($$ select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'restore', 'x') $$, 'P0001', 'invalid_status_for_action', 'only a hidden thing can be restored');
select throws_ok($$ select public.moderate_content('game', '11111111-1111-1111-1111-111111111102', 'hide', 'x') $$, 'P0001', 'invalid_status_for_action', 'and only a published one hidden (not a draft)');
select throws_ok($$ select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'hide', '   ') $$, 'P0001', 'reason_required', 'a reason is required');
select throws_ok($$ select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'hide', repeat('x', 1001)) $$, 'P0001', 'reason_required', 'and not a novel');
select throws_ok($$ select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'delete', 'x') $$, 'P0001', 'invalid_action', 'there is no way to delete');
select throws_ok($$ select public.moderate_content('profile', 'b0000000-0000-0000-0000-000000000002', 'hide', 'x') $$, 'P0001', 'invalid_target_type', 'a profile is not hidden here (suspending is something else)');
select throws_ok($$ select public.moderate_content('game', gen_random_uuid(), 'hide', 'x') $$, 'P0001', 'target_not_found', 'a thing that does not exist is not found');
select is(pg_temp.logged(), 5::bigint, 'and nothing refused leaves a line in the log');

-- ------------------------------------------------------------------ reports
select lives_ok($$ select public.take_report('77777777-7777-7777-7777-777777777701') $$, 'the admin takes a report');
select is((select status from public.reports where id = '77777777-7777-7777-7777-777777777701'), 'reviewing', 'it is under review');
select is(pg_temp.last_log(), 'take_report|admina|report|77777777-7777-7777-7777-777777777701|null', 'and the log says so');
select throws_ok($$ select public.take_report('77777777-7777-7777-7777-777777777701') $$, 'P0001', 'report_not_open', 'a report is taken once');
select throws_ok($$ select public.take_report(gen_random_uuid()) $$, 'P0001', 'report_not_found', 'an unknown report is not found');

select lives_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777701', 'dismissed', 'Not spam, just a bad description') $$, 'the admin dismisses it');
select is((select status || '|' || (resolved_by = 'd0000000-0000-0000-0000-0000000000ad')::text || '|' || (resolved_at is not null)::text || '|' || resolution_note from public.reports where id = '77777777-7777-7777-7777-777777777701'), 'dismissed|true|true|Not spam, just a bad description', 'with who, when and why saved');
select is(pg_temp.last_log(), 'dismiss_report|admina|report|77777777-7777-7777-7777-777777777701|Not spam, just a bad description', 'and logged');
select throws_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777701', 'dismissed', null) $$, 'P0001', 'report_already_resolved', 'a resolved report cannot be resolved again');
select throws_ok($$ select public.take_report('77777777-7777-7777-7777-777777777701') $$, 'P0001', 'report_not_open', 'nor taken again');

select lives_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777702', 'hide_content', 'Insults a person') $$, 'resolving by hiding the content (straight from open)');
select is((select status from public.comments where id = '66666666-6666-6666-6666-666666666610'), 'hidden', 'hides the comment');
select is((select status from public.reports where id = '77777777-7777-7777-7777-777777777702'), 'actioned', 'and the report is actioned');
select is((select string_agg(action, ',' order by id) from (select action, id from public.moderation_log order by id desc limit 2) l), 'hide_comment,action_report', 'both steps are logged (in the same transaction)');
select throws_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777704', 'hide_content', null) $$, 'P0001', 'reason_required', 'hiding needs a reason');
select throws_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777703', 'hide_content', 'x') $$, 'P0001', 'cannot_hide_profile', 'a profile report cannot hide a profile');
select is((select status from public.reports where id in ('77777777-7777-7777-7777-777777777703', '77777777-7777-7777-7777-777777777704') and status <> 'open' limit 1), null, 'and failed attempts leave those reports as they were');
select lives_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777703', 'actioned', 'Talked to them') $$, 'a profile report can be actioned some other way');
select throws_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777704', 'banish', null) $$, 'P0001', 'invalid_outcome', 'an unknown outcome is refused');
select throws_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777704', 'dismissed', repeat('x', 1001)) $$, 'P0001', 'note_too_long', 'and so is a note that is too long');

-- ------------------------------------------------------------------ nobody else
select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'hide', 'Hidden again for the next checks');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.moderate_content('comment', '66666666-6666-6666-6666-666666666610', 'restore', 'I want it back') $$, '42501', 'not_admin', 'the creator cannot restore what was hidden');
select throws_ok($$ select public.take_report('77777777-7777-7777-7777-777777777704') $$, '42501', 'not_admin', 'nor take a report');
select throws_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777704', 'dismissed', null) $$, '42501', 'not_admin', 'nor resolve one');
select throws_ok($$ update public.games set status = 'published' where id = '11111111-1111-1111-1111-111111111101' $$, 'P0001', 'status_change_not_allowed', 'a creator cannot unhide a game by updating it');
select is((select count(*) from public.moderation_log), 0::bigint, 'the log is not readable by them');
select is((select count(*) from public.reports), 2::bigint, 'and they see only their own reports');

select tests.authenticate_as_anon();
select throws_ok($$ select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'hide', 'x') $$, '42501', null, 'anon cannot moderate');
select throws_ok($$ select public.resolve_report('77777777-7777-7777-7777-777777777704', 'dismissed', null) $$, '42501', null, 'anon cannot resolve reports');

select tests.clear_authentication();
update public.profile_private set status = 'suspended' where id = 'd0000000-0000-0000-0000-0000000000ad';
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.moderate_content('post', '55555555-5555-5555-5555-555555555560', 'restore', 'x') $$, '42501', 'not_admin', 'a suspended admin cannot moderate');
select tests.clear_authentication();
update public.profile_private set status = 'active' where id = 'd0000000-0000-0000-0000-0000000000ad';

-- ------------------------------------------------------------------ admins do not get a way to edit or delete
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ update public.reports set status = 'dismissed' where id = '77777777-7777-7777-7777-777777777704' $$, '42501', null, 'not even an admin updates a report directly');
select is(tests.dml_count($$ delete from public.posts where id = '55555555-5555-5555-5555-555555555560' $$), 0::bigint, 'nor deletes what someone published');
select is(tests.dml_count($$ update public.comments set body = 'edited by admin' where id = '66666666-6666-6666-6666-666666666610' $$), 0::bigint, 'nor edits it');
select is(tests.dml_count($$ delete from public.comments where id = '66666666-6666-6666-6666-666666666610' $$), 0::bigint, 'nor deletes a comment');

select * from finish();
rollback;
