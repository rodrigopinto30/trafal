-- Playing games: game_delivery, start_play and play_heartbeat.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
-- A signed-in user who never finished onboarding (no profile row).
select tests.create_user('ghost@trafal.test', 'c0000000-0000-0000-0000-000000000003');

create function pg_temp.make_game(p_title text, p_status text, p_ready boolean default true) returns text language plpgsql as $$
declare
  v_game uuid;
  v_version uuid;
  v_public text;
begin
  insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', p_title) returning id, public_id into v_game, v_public;
  insert into public.game_versions (game_id, number, label, status, needs_isolation, entry_path)
    values (v_game, 1, 'v1', case when p_ready then 'ready' else 'processing' end, p_title = 'Isolated', 'index.html') returning id into v_version;
  if p_ready then
    update public.games set active_version_id = v_version where id = v_game;
  end if;
  if p_status = 'published' then
    update public.games set status = 'published' where id = v_game;
  elsif p_status in ('hidden', 'removed') then
    update public.games set status = 'published' where id = v_game;
    update public.games set status = p_status where id = v_game;
  end if;
  return v_public;
end;
$$;

create temp table ids as
  select pg_temp.make_game('Playable', 'published') as playable,
         pg_temp.make_game('Isolated', 'published') as isolated,
         pg_temp.make_game('Draft', 'draft') as draft,
         pg_temp.make_game('Hidden', 'hidden') as hidden,
         pg_temp.make_game('Removed', 'removed') as removed;
grant select on ids to anon, authenticated;

-- ------------------------------------------------------------------ game_delivery
select tests.authenticate_as_anon();
select is((select state from public.game_delivery((select playable from ids))), 'published', 'a published game is deliverable to a visitor');
select is((select version_number from public.game_delivery((select playable from ids))), 1, 'with its active version');
select is((select entry_path from public.game_delivery((select playable from ids))), 'index.html', 'and its entry file');
select is((select needs_isolation from public.game_delivery((select isolated from ids))), true, 'the isolation requirement is reported');
select is((select count(*) from public.game_delivery((select draft from ids))), 0::bigint, 'a draft returns nothing (the gateway answers 404)');
select is((select state from public.game_delivery((select hidden from ids))), 'gone', 'a hidden game is gone');
select is((select state from public.game_delivery((select removed from ids))), 'gone', 'and so is a taken down one');
select is((select count(*) from public.game_delivery('does-not-exist')), 0::bigint, 'an unknown id returns nothing');
select is((select count(*) from public.game_delivery(null)), 0::bigint, 'and so does null');
select is((select count(*) from public.game_delivery('x'' or true --')), 0::bigint, 'injection attempts are just unknown ids');

-- ------------------------------------------------------------------ start_play
select lives_ok($$ select public.start_play((select playable from ids), '11111111-1111-1111-1111-111111111111', 'desktop') $$, 'a visitor starts a play');
select tests.clear_authentication();
select is((select play_count from public.games where public_id = (select playable from ids)), 1, 'the counter goes up');
select is((select user_id from public.plays), null, 'a visitor leaves no profile on the play');
select is((select device from public.plays), 'desktop', 'only the device class is stored');
select is((select version_id from public.plays), (select active_version_id from public.games where public_id = (select playable from ids)), 'the version that was played is recorded');

select tests.authenticate_as_anon();
select lives_ok($$ select public.start_play((select playable from ids), '11111111-1111-1111-1111-111111111111', 'desktop') $$, 'the same session again is absorbed');
select tests.clear_authentication();
select is((select play_count from public.games where public_id = (select playable from ids)), 1, 'it does not count twice');
select is((select count(*) from public.plays), 1::bigint, 'nor create a second row');

select tests.authenticate_as_anon();
select lives_ok($$ select public.start_play((select playable from ids), '22222222-2222-2222-2222-222222222222', 'mobile') $$, 'another session counts');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.start_play((select playable from ids), '33333333-3333-3333-3333-333333333333', 'tablet') $$, 'a signed-in person plays');
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.start_play((select playable from ids), '44444444-4444-4444-4444-444444444444', 'desktop') $$, 'someone without a profile can play too');
select tests.clear_authentication();
select is((select play_count from public.games where public_id = (select playable from ids)), 4, 'four sessions, four plays');
select is((select user_id from public.plays where session_id = '33333333-3333-3333-3333-333333333333'), 'b0000000-0000-0000-0000-000000000002'::uuid, 'a signed-in play records the profile');
select is((select user_id from public.plays where session_id = '44444444-4444-4444-4444-444444444444'), null, 'but not a missing one');

select tests.authenticate_as_anon();
select throws_ok($$ select public.start_play((select playable from ids), '55555555-5555-5555-5555-555555555555', 'toaster') $$, 'P0001', 'invalid_device', 'the device must be a known class');
select throws_ok($$ select public.start_play((select playable from ids), null, 'desktop') $$, 'P0001', 'invalid_session', 'the session is required');
select throws_ok($$ select public.start_play((select draft from ids), '66666666-6666-6666-6666-666666666666', 'desktop') $$, 'P0001', 'game_not_found', 'a draft cannot be played');
select throws_ok($$ select public.start_play((select hidden from ids), '66666666-6666-6666-6666-666666666666', 'desktop') $$, 'P0001', 'game_not_found', 'neither can a hidden game');
select throws_ok($$ select public.start_play('nope', '66666666-6666-6666-6666-666666666666', 'desktop') $$, 'P0001', 'game_not_found', 'nor an unknown one');
select throws_ok($$ select * from public.plays $$, '42501', null, 'the plays table is closed to visitors');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ update public.games set play_count = 999 where title = 'Playable' $$, '42501', null, 'owners still cannot write the counter');

-- ------------------------------------------------------------------ play_heartbeat
select tests.clear_authentication();
select is((select active_seconds from public.plays where session_id = '11111111-1111-1111-1111-111111111111'), 0, 'a play starts at zero seconds');
select tests.authenticate_as_anon();
select public.play_heartbeat((select playable from ids), '11111111-1111-1111-1111-111111111111');
select tests.clear_authentication();
select is((select active_seconds from public.plays where session_id = '11111111-1111-1111-1111-111111111111'), 0, 'a beat right after the start is ignored (10 s throttle)');

update public.plays set last_beat_at = now() - interval '30 seconds' where session_id = '11111111-1111-1111-1111-111111111111';
select tests.authenticate_as_anon();
select public.play_heartbeat((select playable from ids), '11111111-1111-1111-1111-111111111111');
select tests.clear_authentication();
select is((select active_seconds from public.plays where session_id = '11111111-1111-1111-1111-111111111111'), 30, 'a normal beat adds the time since the last one');
select ok((select last_beat_at from public.plays where session_id = '11111111-1111-1111-1111-111111111111') > now() - interval '5 seconds', 'and moves the last beat to now');

update public.plays set last_beat_at = now() - interval '2 hours' where session_id = '11111111-1111-1111-1111-111111111111';
select tests.authenticate_as_anon();
select public.play_heartbeat((select playable from ids), '11111111-1111-1111-1111-111111111111');
select tests.clear_authentication();
select is((select active_seconds from public.plays where session_id = '11111111-1111-1111-1111-111111111111'), 65, 'a beat after a long pause adds at most 35 seconds');

update public.plays set active_seconds = 14390, last_beat_at = now() - interval '30 seconds' where session_id = '11111111-1111-1111-1111-111111111111';
select tests.authenticate_as_anon();
select public.play_heartbeat((select playable from ids), '11111111-1111-1111-1111-111111111111');
select tests.clear_authentication();
select is((select active_seconds from public.plays where session_id = '11111111-1111-1111-1111-111111111111'), 14400, 'a play never exceeds four hours');

update public.plays set last_beat_at = now() - interval '30 seconds' where session_id = '22222222-2222-2222-2222-222222222222';
select tests.authenticate_as_anon();
select public.play_heartbeat('other-game', '22222222-2222-2222-2222-222222222222');
select public.play_heartbeat((select playable from ids), '99999999-9999-9999-9999-999999999999');
select tests.clear_authentication();
select is((select active_seconds from public.plays where session_id = '22222222-2222-2222-2222-222222222222'), 0, 'a beat for another game or an unknown session changes nothing');

select * from finish();
rollback;
