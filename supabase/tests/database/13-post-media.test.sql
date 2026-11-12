-- Files of an update: the shape of the stored path, the kind/type/extension agreement and the size cap of each kind, plus who can
-- manage the files and the update itself.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555520', 'a0000000-0000-0000-0000-000000000001', 'avance', 'Ana''s update'),
  ('55555555-5555-5555-5555-555555555521', 'b0000000-0000-0000-0000-000000000002', 'avance', 'Bruno''s update');

create function pg_temp.media_path(p_post uuid, p_ext text, p_token text default null) returns text language sql as $$
  select 'posts/' || p_post || '/' || coalesce(p_token, repeat('a', 32)) || '.' || p_ext
$$;

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');

-- ------------------------------------------------------------------ a well-formed file of each kind
select lives_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, width, height, position) values ('55555555-5555-5555-5555-555555555520', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'png', repeat('1', 32)), 'image/png', 5242880, 800, 450, 1) $$, 'an image up to 5 MiB');
select lives_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'gif', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'gif', repeat('2', 32)), 'image/gif', 8388608, 2) $$, 'a GIF up to 8 MiB');
select lives_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'video', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'mp4', repeat('3', 32)), 'video/mp4', 20971520, 3) $$, 'a video up to 20 MiB');

-- ------------------------------------------------------------------ size cap by kind
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'webp', repeat('4', 32)), 'image/webp', 5242881, 4) $$, '23514', null, 'an image over 5 MiB');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'gif', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'gif', repeat('4', 32)), 'image/gif', 8388609, 4) $$, '23514', null, 'a GIF over 8 MiB');

-- ------------------------------------------------------------------ the path
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555521', 'png', repeat('4', 32)), 'image/png', 100, 4) $$, '23514', null, 'a path in another post''s folder');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', 'avatars/a0000000-0000-0000-0000-000000000001/' || repeat('4', 32) || '.png', 'image/png', 100, 4) $$, '23514', null, 'a path in another folder of the bucket');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', 'https://evil.example/x.png', 'image/png', 100, 4) $$, '23514', null, 'an external address');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', 'posts/55555555-5555-5555-5555-555555555520/../' || repeat('4', 32) || '.png', 'image/png', 100, 4) $$, '23514', null, 'a path that climbs out of the folder');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', 'posts/55555555-5555-5555-5555-555555555520/cover.png', 'image/png', 100, 4) $$, '23514', null, 'a name that is not random');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'svg', repeat('4', 32)), 'image/png', 100, 4) $$, '23514', null, 'an extension that is not allowed');

-- ------------------------------------------------------------------ kind, type and extension agree
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'video', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'png', repeat('4', 32)), 'image/png', 100, 4) $$, '23514', null, 'a video that is a PNG');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'mp4', repeat('4', 32)), 'image/png', 100, 4) $$, '23514', null, 'a PNG stored with an .mp4 name');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'gif', repeat('4', 32)), 'image/gif', 100, 4) $$, '23514', null, 'a GIF that claims to be a plain image');

-- ------------------------------------------------------------------ the author manages the files, nobody else
select is((select count(*) from public.post_media where post_id = '55555555-5555-5555-5555-555555555520'), 3::bigint, 'ana has her three files');
select throws_ok($$ update public.post_media set path = pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'png', repeat('9', 32)) $$, '42501', null, 'the path of a stored file cannot be changed');
select throws_ok($$ update public.post_media set bytes = 1 $$, '42501', null, 'neither its size');
select lives_ok($$ update public.post_media set alt_text = 'A description' where position = 1 $$, 'but its description can');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555520', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555520', 'png', repeat('5', 32)), 'image/png', 100, 4) $$, '42501', null, 'bruno cannot add a file to ana''s update');
select is(tests.dml_count($$ update public.post_media set alt_text = 'hacked' $$), 0::bigint, 'nor edit her files');
select is(tests.dml_count($$ delete from public.post_media $$), 0::bigint, 'nor delete them');

-- ------------------------------------------------------------------ the update itself
select is(tests.dml_count($$ update public.posts set body = 'hacked' where id = '55555555-5555-5555-5555-555555555520' $$), 0::bigint, 'bruno cannot edit ana''s update');
select is(tests.dml_count($$ delete from public.posts where id = '55555555-5555-5555-5555-555555555520' $$), 0::bigint, 'nor delete it');
select is(tests.dml_count($$ update public.posts set body = 'Bruno edits his own' where id = '55555555-5555-5555-5555-555555555521' $$), 1::bigint, 'but he edits his own');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(tests.dml_count($$ delete from public.posts where id = '55555555-5555-5555-5555-555555555520' $$), 1::bigint, 'ana deletes hers');
select is((select count(*) from public.post_media), 0::bigint, 'and its files go with it');
select is((select count(*) from public.posts where id = '55555555-5555-5555-5555-555555555521'), 1::bigint, 'bruno''s update is untouched');

-- ------------------------------------------------------------------ editing everything at once (edit_post)
select tests.clear_authentication();
insert into public.games (id, owner_id, title, genre_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Ana''s game', 'puzzle'),
  ('11111111-1111-1111-1111-111111111102', 'b0000000-0000-0000-0000-000000000002', 'Bruno''s game', 'puzzle');
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555530', 'a0000000-0000-0000-0000-000000000001', 'avance', 'To be edited');

create function pg_temp.item(p_post uuid, p_ext text, p_token text, p_kind text, p_mime text, p_alt text default '') returns jsonb language sql as $$
  select jsonb_build_object('kind', p_kind, 'path', pg_temp.media_path(p_post, p_ext, p_token), 'mime', p_mime, 'bytes', 1000, 'width', 64, 'height', 48, 'alt_text', p_alt)
$$;

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'hito', ' New text ', '11111111-1111-1111-1111-111111111101', ' 100 ', jsonb_build_array(
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'png', repeat('a', 32), 'image', 'image/png', 'first'),
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'gif', repeat('b', 32), 'gif', 'image/gif'))) $$, 'ana changes the kind, the game, the text, the highlight and the files at once');
select is((select kind || '|' || body || '|' || highlight || '|' || (game_id is not null)::text from public.posts where id = '55555555-5555-5555-5555-555555555530'), 'hito|New text|100|true', 'the fields changed (text trimmed)');
select is((select string_agg(position || ':' || kind || ':' || alt_text, ',' order by position) from public.post_media where post_id = '55555555-5555-5555-5555-555555555530'), '1:image:first,2:gif:', 'the files are in the given order');

select lives_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'Reordered', null, 'ignored', jsonb_build_array(
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'gif', repeat('b', 32), 'gif', 'image/gif', 'now first'),
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'png', repeat('a', 32), 'image', 'image/png'))) $$, 'the files can be swapped');
select is((select string_agg(position || ':' || kind, ',' order by position) from public.post_media where post_id = '55555555-5555-5555-5555-555555555530'), '1:gif,2:image', 'in the new order');
select is((select highlight from public.posts where id = '55555555-5555-5555-5555-555555555530'), null, 'a highlight only stays on a milestone');
select is((select game_id from public.posts where id = '55555555-5555-5555-5555-555555555530'), null, 'and the game can be taken off');

select lives_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'No files', null, '', '[]'::jsonb) $$, 'all the files can be removed');
select is((select count(*) from public.post_media where post_id = '55555555-5555-5555-5555-555555555530'), 0::bigint, 'none are left');

-- Everything or nothing: a bad file in the list undoes the whole edit.
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'hito', 'Should not stick', null, '9', jsonb_build_array(
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'png', repeat('c', 32), 'image', 'image/png'),
  pg_temp.item('55555555-5555-5555-5555-555555555521', 'png', repeat('d', 32), 'image', 'image/png'))) $$, '23514', null, 'a file in another post''s folder fails the edit');
select is((select body from public.posts where id = '55555555-5555-5555-5555-555555555530'), 'No files', 'and the text did not change');
select is((select count(*) from public.post_media where post_id = '55555555-5555-5555-5555-555555555530'), 0::bigint, 'nor the files');
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'Five', null, '', jsonb_build_array(
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'png', repeat('1', 32), 'image', 'image/png'),
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'png', repeat('2', 32), 'image', 'image/png'),
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'png', repeat('3', 32), 'image', 'image/png'),
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'png', repeat('4', 32), 'image', 'image/png'),
  pg_temp.item('55555555-5555-5555-5555-555555555530', 'png', repeat('5', 32), 'image', 'image/png'))) $$, '23514', null, 'more than four files fail');
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'nuevo_juego', 'Launch', null, '', '[]'::jsonb) $$, '23514', null, 'a launch without a game fails');
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'Stolen game', '11111111-1111-1111-1111-111111111102', '', '[]'::jsonb) $$, 'P0001', 'game_not_owned', 'a game of someone else cannot be linked');
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'x', null, '', '{"not": "a list"}'::jsonb) $$, 'P0001', 'invalid_media', 'the files must be a list');

-- Nobody else can edit it, and an update that does not exist is not found.
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'Hacked', null, '', '[]'::jsonb) $$, 'P0001', 'post_not_found', 'bruno cannot edit ana''s update through the function');
select throws_ok($$ select public.edit_post('99999999-9999-9999-9999-999999999999', 'avance', 'x', null, '', '[]'::jsonb) $$, 'P0001', 'post_not_found', 'an unknown update is not found');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select body from public.posts where id = '55555555-5555-5555-5555-555555555530'), 'No files', 'ana''s update is intact');

select tests.authenticate_as_anon();
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'anon', null, '', '[]'::jsonb) $$, '42501', null, 'anon cannot call it');

-- A moderated update cannot be edited by its author, and a suspended account cannot edit.
select tests.clear_authentication();
update public.posts set status = 'hidden' where id = '55555555-5555-5555-5555-555555555530';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'Back from hidden', null, '', '[]'::jsonb) $$, 'P0001', 'post_not_found', 'a moderated update cannot be edited');
select tests.clear_authentication();
update public.posts set status = 'published' where id = '55555555-5555-5555-5555-555555555530';
update public.profile_private set status = 'suspended' where id = 'a0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.edit_post('55555555-5555-5555-5555-555555555530', 'avance', 'Suspended edit', null, '', '[]'::jsonb) $$, 'P0001', 'post_not_found', 'a suspended account cannot edit');
select tests.clear_authentication();
update public.profile_private set status = 'active' where id = 'a0000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------------------ nothing without an account
select tests.authenticate_as_anon();
select throws_ok($$ insert into public.posts (author_id, kind, body) values ('a0000000-0000-0000-0000-000000000001', 'avance', 'anonymous') $$, '42501', null, 'anon cannot publish');
select throws_ok($$ delete from public.posts $$, '42501', null, 'anon cannot delete');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555521', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555521', 'png', repeat('6', 32)), 'image/png', 100, 1) $$, '42501', null, 'anon cannot add files');

select * from finish();
rollback;
