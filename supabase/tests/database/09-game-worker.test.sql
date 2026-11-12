-- Game worker: the queue functions and the minimal role.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

create function pg_temp.game_id() returns uuid language sql as $$ select id from public.games where title = 'Worker Game' $$;
create function pg_temp.version_id(p_number integer) returns uuid language sql as $$ select id from public.game_versions where game_id = pg_temp.game_id() and number = p_number $$;

-- Runs one statement as the worker role (the assertions themselves run as the test user: the worker role cannot see pgTAP).
create function pg_temp.as_worker(p_sql text) returns void language plpgsql as $$
begin
  set local role game_worker;
  execute p_sql;
  reset role;
end;
$$;

-- Claims one version as the worker and returns its id, or null when the queue is empty.
create function pg_temp.claim(p_worker text) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  set local role game_worker;
  select c.version_id into v_id from worker.claim_version(p_worker) c;
  reset role;
  return v_id;
end;
$$;

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Worker Game');
select public.create_game_version(pg_temp.game_id(), 5000);
select public.create_game_version(pg_temp.game_id(), 7000);
select public.confirm_version_upload(pg_temp.version_id(1));

-- ------------------------------------------------------------------ who can call what
select throws_ok($$ select * from worker.claim_version('x') $$, '42501', null, 'a signed-in person cannot claim versions');
select tests.authenticate_as_anon();
select throws_ok($$ select * from worker.claim_version('x') $$, '42501', null, 'a visitor cannot claim versions');
select tests.clear_authentication();
select ok(not has_function_privilege('anon', 'worker.complete_version(uuid, integer, bigint, bigint, boolean, jsonb)', 'execute'), 'anon cannot complete versions');
select ok(not has_function_privilege('authenticated', 'worker.fail_version(uuid, text, jsonb, jsonb)', 'execute'), 'authenticated cannot fail versions');
select ok(not has_function_privilege('authenticated', 'worker.release_version(uuid)', 'execute'), 'authenticated cannot release versions');
select ok(has_function_privilege('game_worker', 'worker.claim_version(text, interval, integer)', 'execute'), 'the worker role can claim');
select ok(not has_schema_privilege('authenticated', 'worker', 'usage'), 'the schema is closed to the API roles');
select ok(not has_function_privilege('game_worker', 'public.create_game_version(uuid, bigint, text, text)', 'execute'), 'the worker role cannot create versions');
select ok(not has_table_privilege('game_worker', 'public.games', 'select'), 'the worker role has no table access');
select ok(not has_table_privilege('game_worker', 'public.game_versions', 'update'), 'not even on versions');
select ok(not has_table_privilege('game_worker', 'public.profile_private', 'select'), 'nor on private data');

-- ------------------------------------------------------------------ claim
select is(pg_temp.claim('worker-1'), pg_temp.version_id(1), 'the worker claims the queued version');
select is((select locked_by from public.game_versions where number = 1), 'worker-1', 'it is locked by that worker');
select isnt((select locked_at from public.game_versions where number = 1), null, 'with a lock time');
select is((select attempts from public.game_versions where number = 1), 1, 'one attempt is counted');
select is(pg_temp.claim('worker-2'), null, 'nobody else gets a version that is locked');

select is((select count(*) from public.game_versions where number = 2 and locked_at is null), 1::bigint, 'versions still uploading are never touched');

-- ------------------------------------------------------------------ stale locks and attempts
update public.game_versions set locked_at = now() - interval '11 minutes' where number = 1;
select is(pg_temp.claim('worker-2'), pg_temp.version_id(1), 'a stale lock is claimed again');
select is((select attempts from public.game_versions where number = 1), 2, 'with the second attempt counted');
select is((select locked_by from public.game_versions where number = 1), 'worker-2', 'by the new worker');

select pg_temp.as_worker(format('select worker.release_version(%L)', pg_temp.version_id(1)));
select is((select locked_at from public.game_versions where number = 1), null, 'release unlocks the version');
select is((select status from public.game_versions where number = 1), 'processing', 'and keeps it in the queue');
select is(pg_temp.claim('worker-3'), pg_temp.version_id(1), 'so it can be claimed right away (third attempt)');

select pg_temp.as_worker(format('select worker.release_version(%L)', pg_temp.version_id(1)));
select is(pg_temp.claim('worker-3'), null, 'a version out of attempts is not claimed');
select is((select status from public.game_versions where number = 1), 'error', 'it fails for good');
select is((select error_code from public.game_versions where number = 1), 'PROCESSING_FAILED', 'with a stable code');
select is((select locked_at from public.game_versions where number = 1), null, 'and no lock');

-- ------------------------------------------------------------------ complete
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select public.create_game_version(pg_temp.game_id(), 9000);
select public.confirm_version_upload(pg_temp.version_id(3));
select public.confirm_version_upload(pg_temp.version_id(2));
select tests.clear_authentication();

select is(pg_temp.claim('worker-1'), pg_temp.version_id(3), 'the oldest confirmed version goes first');
select throws_ok(format('select pg_temp.as_worker(%L)', format('select worker.complete_version(%L, 1, 1, 1, false, ''[]''::jsonb)', pg_temp.version_id(4))), 'P0001', 'version_not_found', 'an unknown version is not found');
select lives_ok(format('select pg_temp.as_worker(%L)', format('select worker.complete_version(%L, 3, 12046, 4180, true, ''["TOP_NAVIGATION_ATTEMPT"]''::jsonb)', pg_temp.version_id(3))), 'the worker completes a version');
select is((select status from public.game_versions where number = 3), 'ready', 'it is ready');
select is((select file_count from public.game_versions where number = 3), 3, 'with its file count');
select is((select unpacked_bytes from public.game_versions where number = 3), 12046::bigint, 'unpacked size');
select is((select size_bytes from public.game_versions where number = 3), 4180::bigint, 'zip size');
select is((select needs_isolation from public.game_versions where number = 3), true, 'isolation flag');
select is((select scan_flags from public.game_versions where number = 3), '["TOP_NAVIGATION_ATTEMPT"]'::jsonb, 'scan flags');
select is((select locked_at from public.game_versions where number = 3), null, 'the lock is cleared');
select is((select active_version_id from public.games where title = 'Worker Game'), pg_temp.version_id(3), 'the first ready version becomes the active one');
select is((select status from public.games where title = 'Worker Game'), 'draft', 'the game stays a draft: publishing is the owner''s choice');
select throws_ok(format('select pg_temp.as_worker(%L)', format('select worker.complete_version(%L, 1, 1, 1, false, ''[]''::jsonb)', pg_temp.version_id(3))), 'P0001', 'invalid_state', 'a ready version cannot be completed twice');

select is(pg_temp.claim('worker-1'), pg_temp.version_id(2), 'the next version is claimed');
select lives_ok(format('select pg_temp.as_worker(%L)', format('select worker.complete_version(%L, 1, 10, 10, false, null)', pg_temp.version_id(2))), 'a second version completes');
select is((select scan_flags from public.game_versions where number = 2), '[]'::jsonb, 'missing scan flags become an empty list');
select is((select active_version_id from public.games where title = 'Worker Game'), pg_temp.version_id(3), 'the active version does not change by itself');

-- ------------------------------------------------------------------ fail
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select public.create_game_version(pg_temp.game_id(), 100);
select public.confirm_version_upload(pg_temp.version_id(4));
select public.create_game_version(pg_temp.game_id(), 100);
select public.confirm_version_upload(pg_temp.version_id(5));
select tests.clear_authentication();
select is(pg_temp.claim('worker-1'), pg_temp.version_id(4), 'version 4 is claimed');
select lives_ok(format('select pg_temp.as_worker(%L)', format('select worker.fail_version(%L, ''NO_INDEX_HTML'', ''{"file": "index.html"}''::jsonb, ''[]''::jsonb)', pg_temp.version_id(4))), 'the worker rejects a version');
select is((select status from public.game_versions where number = 4), 'error', 'it is an error');
select is((select error_code from public.game_versions where number = 4), 'NO_INDEX_HTML', 'with the validator code');
select is((select error_params from public.game_versions where number = 4), '{"file": "index.html"}'::jsonb, 'and its parameters');
select throws_ok(format('select pg_temp.as_worker(%L)', format('select worker.fail_version(%L, ''NO_INDEX_HTML'', ''{}''::jsonb, ''[]''::jsonb)', pg_temp.version_id(4))), 'P0001', 'invalid_state', 'a rejected version cannot be rejected again');

select throws_ok(format('select pg_temp.as_worker(%L)', format('select worker.fail_version(%L, ''lower case'', ''{}''::jsonb, ''[]''::jsonb)', pg_temp.version_id(5))), 'P0001', 'invalid_error_code', 'the error code must look like a code');
select throws_ok(format('select pg_temp.as_worker(%L)', format('select worker.fail_version(%L, null, ''{}''::jsonb, ''[]''::jsonb)', pg_temp.version_id(5))), 'P0001', 'invalid_error_code', 'and cannot be missing');
select lives_ok(format('select pg_temp.as_worker(%L)', format('select worker.fail_version(%L, ''UNSAFE_PATH'', jsonb_build_object(''path'', repeat(''x'', 5000)), null)', pg_temp.version_id(5))), 'a huge parameter set is accepted but dropped');
select is((select error_params from public.game_versions where number = 5), '{}'::jsonb, 'oversized parameters are not stored');

-- ------------------------------------------------------------------ what the owner sees and can still not do
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select status from public.game_versions where number = 3), 'ready', 'ana sees the result of her version');
select is((select error_code from public.game_versions where number = 4), 'NO_INDEX_HTML', 'and the reason a version was rejected');
select lives_ok($$ update public.games set status = 'published' where title = 'Worker Game' $$, 'now ana can publish her game (it has a ready version)');
select throws_ok($$ select * from worker.claim_version('x') $$, '42501', null, 'and she still cannot touch the queue');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.game_versions where status = 'error'), 0::bigint, 'bruno does not see the rejected versions of ana');

select * from finish();
rollback;
