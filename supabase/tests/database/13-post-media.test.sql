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

-- ------------------------------------------------------------------ nothing without an account
select tests.authenticate_as_anon();
select throws_ok($$ insert into public.posts (author_id, kind, body) values ('a0000000-0000-0000-0000-000000000001', 'avance', 'anonymous') $$, '42501', null, 'anon cannot publish');
select throws_ok($$ delete from public.posts $$, '42501', null, 'anon cannot delete');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) values ('55555555-5555-5555-5555-555555555521', 'image', pg_temp.media_path('55555555-5555-5555-5555-555555555521', 'png', repeat('6', 32)), 'image/png', 100, 1) $$, '42501', null, 'anon cannot add files');

select * from finish();
rollback;
