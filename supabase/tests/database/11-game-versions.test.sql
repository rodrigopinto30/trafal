-- Game versions: choosing the active version, and editing a version's label and changelog.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

create function pg_temp.game_id(p_title text) returns uuid language sql as $$ select id from public.games where title = p_title $$;
create function pg_temp.version_id(p_title text, p_number integer) returns uuid language sql as $$
  select id from public.game_versions where game_id = pg_temp.game_id(p_title) and number = p_number
$$;
create function pg_temp.active(p_title text) returns uuid language sql as $$ select active_version_id from public.games where title = p_title $$;

-- Two games for ana, the first with three versions: 1 and 2 ready, 3 still processing.
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Versioned');
insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Other');
select public.create_game_version(pg_temp.game_id('Versioned'), 100);
select public.create_game_version(pg_temp.game_id('Versioned'), 200, 'Second try', 'Faster enemies');
select public.create_game_version(pg_temp.game_id('Versioned'), 300);
select public.create_game_version(pg_temp.game_id('Other'), 100);
select tests.clear_authentication();
update public.game_versions set status = 'ready' where number in (1, 2) and game_id = pg_temp.game_id('Versioned');
update public.game_versions set status = 'processing' where number = 3 and game_id = pg_temp.game_id('Versioned');
update public.game_versions set status = 'ready' where game_id = pg_temp.game_id('Other');
update public.games set active_version_id = pg_temp.version_id('Versioned', 1) where title = 'Versioned';

-- ------------------------------------------------------------------ choosing the active version
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.set_active_version(pg_temp.version_id('Versioned', 2)) $$, 'the owner switches to a newer ready version');
select is(pg_temp.active('Versioned'), pg_temp.version_id('Versioned', 2), 'it is now the active one');
select lives_ok($$ select public.set_active_version(pg_temp.version_id('Versioned', 1)) $$, 'and can go back to an older one');
select is(pg_temp.active('Versioned'), pg_temp.version_id('Versioned', 1), 'which becomes active again');
select lives_ok($$ select public.set_active_version(pg_temp.version_id('Versioned', 1)) $$, 'choosing the active one again is harmless');
select throws_ok($$ select public.set_active_version(pg_temp.version_id('Versioned', 3)) $$, 'P0001', 'version_not_ready', 'a version that is not ready cannot be chosen');
select is(pg_temp.active('Versioned'), pg_temp.version_id('Versioned', 1), 'and nothing changed');
select throws_ok($$ select public.set_active_version('99999999-0000-0000-0000-000000000009') $$, 'P0001', 'version_not_found', 'an unknown version is not found');
select is(pg_temp.active('Other'), null, 'the other game was never touched');
select lives_ok($$ select public.set_active_version(pg_temp.version_id('Other', 1)) $$, 'each game has its own active version');
select is(pg_temp.active('Versioned'), pg_temp.version_id('Versioned', 1), 'without affecting the first game');

select throws_ok($$ update public.games set active_version_id = (select id from public.game_versions where number = 2 limit 1) where title = 'Versioned' $$, '42501', null, 'the column is still closed to direct writes');

-- ------------------------------------------------------------------ nobody else
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.set_active_version(pg_temp.version_id('Versioned', 2)) $$, 'P0001', 'version_not_found', 'someone else cannot switch the version of a game that is not theirs');
select tests.authenticate_as_anon();
select throws_ok($$ select public.set_active_version(pg_temp.version_id('Versioned', 2)) $$, '42501', null, 'visitors cannot either');
select tests.clear_authentication();
select is(pg_temp.active('Versioned'), pg_temp.version_id('Versioned', 1), 'the active version is unchanged');

update public.profile_private set status = 'suspended' where id = 'a0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.set_active_version(pg_temp.version_id('Versioned', 2)) $$, '42501', null, 'a suspended account cannot switch versions');
select tests.clear_authentication();
update public.profile_private set status = 'active' where id = 'a0000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------------------ label and changelog
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(tests.dml_count($$ update public.game_versions set label = 'v0.2 beta', changelog = 'New level and a fix' where id = pg_temp.version_id('Versioned', 2) $$), 1::bigint, 'the owner renames a version and writes its changelog');
select is((select label from public.game_versions where id = pg_temp.version_id('Versioned', 2)), 'v0.2 beta', 'the label is saved');
select is((select changelog from public.game_versions where id = pg_temp.version_id('Versioned', 2)), 'New level and a fix', 'and so is the changelog');
select throws_ok($$ update public.game_versions set label = '' where id = pg_temp.version_id('Versioned', 2) $$, '23514', null, 'the label cannot be empty');
select throws_ok($$ update public.game_versions set label = repeat('x', 25) where id = pg_temp.version_id('Versioned', 2) $$, '23514', null, 'nor longer than 24 characters');
select throws_ok($$ update public.game_versions set changelog = repeat('x', 2001) where id = pg_temp.version_id('Versioned', 2) $$, '23514', null, 'the changelog is capped at 2000 characters');
select throws_ok($$ update public.game_versions set number = 9 where id = pg_temp.version_id('Versioned', 2) $$, '42501', null, 'the number is not editable');
select throws_ok($$ update public.game_versions set status = 'error' where id = pg_temp.version_id('Versioned', 2) $$, '42501', null, 'nor the status');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(tests.dml_count($$ update public.game_versions set label = 'hacked' where id = pg_temp.version_id('Versioned', 2) $$), 0::bigint, 'someone else cannot edit it');
select tests.authenticate_as_anon();

-- ------------------------------------------------------------------ what the public sees
select tests.clear_authentication();
update public.games set status = 'published' where title = 'Versioned';
select tests.authenticate_as_anon();
select is((select count(*) from public.game_versions where game_id = pg_temp.game_id('Versioned')), 2::bigint, 'visitors see only the ready versions of a published game');
select is((select label from public.game_versions where game_id = pg_temp.game_id('Versioned') and number = 2), 'v0.2 beta', 'with their labels');
select is((select changelog from public.game_versions where game_id = pg_temp.game_id('Versioned') and number = 2), 'New level and a fix', 'and their changelogs');

select * from finish();
rollback;
