-- Game upload: create_game_version, confirm_version_upload and the image path checks.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Ana Game One');
insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Ana Game Two');
create function pg_temp.game_id(p_title text) returns uuid language sql as $$ select id from public.games where title = p_title $$;
create function pg_temp.game_one() returns uuid language sql as $$ select pg_temp.game_id('Ana Game One') $$;
create function pg_temp.game_two() returns uuid language sql as $$ select pg_temp.game_id('Ana Game Two') $$;

-- ------------------------------------------------------------------ create_game_version
create temp table first_version as
  select * from public.create_game_version(pg_temp.game_one(), 1048576);
grant select on first_version to authenticated;

select is((select version_number from first_version), 1, 'the first version is number 1');
select is((select quarantine_key from first_version), pg_temp.game_one()::text || '/' || (select version_id from first_version) || '.zip', 'the quarantine key is game/version.zip');
select is((select label from public.game_versions where id = (select version_id from first_version)), 'v1', 'the default label is v<number>');
select is((select status from public.game_versions where id = (select version_id from first_version)), 'uploading', 'it starts as uploading');
select is((select declared_size_bytes from public.game_versions where id = (select version_id from first_version)), 1048576::bigint, 'the declared size is stored');
select is((select version_number from public.create_game_version(pg_temp.game_one(), 2048, '  v0.2-beta ', 'Fixed the jump')), 2, 'the next version is number 2');
select is((select label from public.game_versions where game_id = pg_temp.game_one() and number = 2), 'v0.2-beta', 'a custom label is trimmed and kept');
select is((select changelog from public.game_versions where game_id = pg_temp.game_one() and number = 2), 'Fixed the jump', 'the changelog is kept');

select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), 0) $$, 'P0001', 'invalid_size', 'size zero is rejected');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), -5) $$, 'P0001', 'invalid_size', 'a negative size is rejected');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), 209715201) $$, 'P0001', 'invalid_size', 'one byte over the zip limit is rejected');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), null) $$, 'P0001', 'invalid_size', 'a missing size is rejected');
select lives_ok($$ select * from public.create_game_version(pg_temp.game_one(), 209715200) $$, 'exactly the zip limit is accepted');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), 10, repeat('x', 25)) $$, '23514', null, 'the label keeps its length check');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), 10, null, repeat('x', 2001)) $$, '23514', null, 'the changelog keeps its length check');
select throws_ok($$ select * from public.create_game_version('99999999-0000-0000-0000-000000000009', 10) $$, 'P0001', 'game_not_found', 'an unknown game is not found');

-- The daily quota counts versions of ALL the owner's games (3 so far; the rejected attempts rolled back).
select lives_ok($$ select * from public.create_game_version(pg_temp.game_two(), 10) $$, 'the 4th upload of the day is accepted (other game)');
select lives_ok($$ select * from public.create_game_version(pg_temp.game_two(), 10) $$, 'the 5th upload of the day is accepted');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_two(), 10) $$, 'P0001', 'daily_limit_reached', 'the 6th upload of the day is refused');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), 10) $$, 'P0001', 'daily_limit_reached', 'the quota is shared by all of the owner''s games');

select tests.clear_authentication();
update public.game_versions set created_at = now() - interval '25 hours' where game_id = pg_temp.game_one() and number = 1;
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select * from public.create_game_version(pg_temp.game_one(), 10) $$, 'the quota frees up as old uploads leave the 24 hour window');

-- ------------------------------------------------------------------ nobody else
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), 10) $$, 'P0001', 'game_not_found', 'bruno cannot create versions of ana''s game');
select is((select count(*) from public.game_versions), 0::bigint, 'and sees none of ana''s unfinished versions');
select throws_ok($$ insert into public.game_versions (game_id, number, label) values (pg_temp.game_one(), 50, 'v50') $$, '42501', null, 'versions still cannot be inserted directly');

select tests.authenticate_as_anon();
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), 10) $$, '42501', null, 'visitors cannot create versions');
select throws_ok($$ select public.confirm_version_upload(pg_temp.game_one()) $$, '42501', null, 'visitors cannot confirm uploads');

-- ------------------------------------------------------------------ confirm_version_upload
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.confirm_version_upload((select version_id from first_version)) $$, 'ana confirms her upload');
select is((select status from public.game_versions where id = (select version_id from first_version)), 'processing', 'the version is now in the worker queue');
select isnt((select uploaded_at from public.game_versions where id = (select version_id from first_version)), null, 'the upload time is recorded');
select is((select locked_at from public.game_versions where id = (select version_id from first_version)), null, 'and nobody holds it yet');
select throws_ok($$ select public.confirm_version_upload((select version_id from first_version)) $$, 'P0001', 'invalid_state', 'a version cannot be confirmed twice');
select throws_ok($$ select public.confirm_version_upload('99999999-0000-0000-0000-000000000009') $$, 'P0001', 'version_not_found', 'an unknown version is not found');
select throws_ok($$ update public.game_versions set status = 'ready' where id = (select version_id from first_version) $$, '42501', null, 'the owner still cannot mark a version ready');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.confirm_version_upload((select version_id from first_version)) $$, 'P0001', 'version_not_found', 'bruno cannot confirm ana''s upload');

-- A suspended account can do neither.
select tests.clear_authentication();
update public.profile_private set status = 'suspended' where id = 'a0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select * from public.create_game_version(pg_temp.game_one(), 10) $$, '42501', null, 'a suspended account cannot create versions');
select throws_ok($$ select public.confirm_version_upload((select version_id from first_version)) $$, '42501', null, 'a suspended account cannot confirm uploads');

-- ------------------------------------------------------------------ image paths
select tests.clear_authentication();
update public.profile_private set status = 'active' where id = 'a0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ update public.games set cover_path = 'covers/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.webp' where id = pg_temp.game_one() $$, 'a cover inside the owner''s folder is accepted');
select throws_ok($$ update public.games set cover_path = 'covers/b0000000-0000-0000-0000-000000000002/0123456789abcdef0123456789abcdef.webp' where id = pg_temp.game_one() $$, '23514', null, 'a cover in someone else''s folder is rejected');
select throws_ok($$ update public.games set cover_path = 'avatars/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.webp' where id = pg_temp.game_one() $$, '23514', null, 'a cover cannot point to an avatar');
select throws_ok($$ update public.games set cover_path = 'covers/a0000000-0000-0000-0000-000000000001/../x.webp' where id = pg_temp.game_one() $$, '23514', null, 'path tricks are rejected');
select throws_ok($$ update public.games set cover_path = 'covers/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.svg' where id = pg_temp.game_one() $$, '23514', null, 'only webp, jpg and png covers');
select lives_ok($$ insert into public.game_screenshots (game_id, path, position) values (pg_temp.game_one(), 'screenshots/' || pg_temp.game_one() || '/0123456789abcdef0123456789abcdef.png', 1) $$, 'a screenshot inside the game''s folder is accepted');
select throws_ok($$ insert into public.game_screenshots (game_id, path, position) values (pg_temp.game_one(), 'screenshots/' || pg_temp.game_two() || '/0123456789abcdef0123456789abcdef.png', 2) $$, '23514', null, 'a screenshot of another game is rejected');
select throws_ok($$ insert into public.game_screenshots (game_id, path, position) values (pg_temp.game_one(), 'covers/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.png', 2) $$, '23514', null, 'a screenshot cannot point to a cover');

select * from finish();
rollback;
