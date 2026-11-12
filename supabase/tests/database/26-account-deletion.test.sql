-- Account deletion: a person deletes only their own account, everything that hangs from it goes, what has to stay stays, admins cannot
-- delete theirs, and the list of folders in object storage covers exactly what the account owns (and nobody else's).
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

insert into public.games (id, owner_id, public_id, title, short_description, genre_id, cover_path) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'anagame01', 'Ana''s game', 'A game', 'puzzle', 'covers/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.webp'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'anagame02', 'Ana''s draft', 'x', 'puzzle', null),
  ('11111111-1111-1111-1111-111111111103', 'b0000000-0000-0000-0000-000000000002', 'brugame01', 'Bruno''s game', 'A game', 'puzzle', null);
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v1', 'ready'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103', 1, 'v1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222203', status = 'published' where id = '11111111-1111-1111-1111-111111111103';
insert into public.game_screenshots (game_id, path, position) values
  ('11111111-1111-1111-1111-111111111101', 'screenshots/11111111-1111-1111-1111-111111111101/0123456789abcdef0123456789abcdef.webp', 1);

insert into public.posts (id, author_id, game_id, kind, body) values
  ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', 'avance', 'An update of ana'),
  ('55555555-5555-5555-5555-555555555502', 'a0000000-0000-0000-0000-000000000001', null, 'avance', 'A loose update of ana'),
  ('55555555-5555-5555-5555-555555555503', 'b0000000-0000-0000-0000-000000000002', null, 'avance', 'An update of bruno');
insert into public.post_media (post_id, kind, path, mime, bytes, position) values
  ('55555555-5555-5555-5555-555555555501', 'image', 'posts/55555555-5555-5555-5555-555555555501/0123456789abcdef0123456789abcdef.webp', 'image/webp', 1000, 1);

insert into public.comments (id, author_id, game_id, body) values
  ('66666666-6666-6666-6666-666666666601', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111103', 'Ana comments on bruno''s game'),
  ('66666666-6666-6666-6666-666666666602', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', 'Bruno comments on ana''s game');
insert into public.comments (id, author_id, game_id, parent_id, body) values
  ('66666666-6666-6666-6666-666666666603', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111103', '66666666-6666-6666-6666-666666666601', 'Bruno replies to ana');
insert into public.game_likes (user_id, game_id) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111103');
insert into public.follows (follower_id, followee_id) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001');

select tests.clear_authentication();
insert into public.moderation_log (admin_id, admin_username, action, target_type, target_id, reason)
values ('d0000000-0000-0000-0000-0000000000ad', 'admina', 'hide', 'game', '11111111-1111-1111-1111-111111111101', 'A reason');
insert into public.copyright_claims (claimant_name, claimant_email, work_description, infringing_urls, statement_good_faith, statement_accuracy, signature, game_id)
values ('Carla', 'carla@example.com', 'A work description', array['https://trafal.example/games/anagame01'], true, true, 'Carla', '11111111-1111-1111-1111-111111111101');

-- ------------------------------------------------------------------ who can call it
select tests.authenticate_as_anon();
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'a visitor cannot delete an account');
select throws_ok($$ select * from public.account_files() $$, '42501', null, 'nor list its files');

-- ------------------------------------------------------------------ the list of files
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(
  (select string_agg(bucket || ':' || prefix, ', ' order by bucket, prefix) from public.account_files()),
  'games:anagame01/, games:anagame02/, media:avatars/a0000000-0000-0000-0000-000000000001/, media:covers/a0000000-0000-0000-0000-000000000001/, '
  || 'media:posts/55555555-5555-5555-5555-555555555501/, media:posts/55555555-5555-5555-5555-555555555502/, '
  || 'media:screenshots/11111111-1111-1111-1111-111111111101/, media:screenshots/11111111-1111-1111-1111-111111111102/, '
  || 'quarantine:11111111-1111-1111-1111-111111111101/, quarantine:11111111-1111-1111-1111-111111111102/',
  'the files of ana: her avatar and covers, her updates, and the screenshots, zips and published files of each of her games, and nothing of bruno'
);
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(
  (select string_agg(bucket || ':' || prefix, ', ' order by bucket, prefix) from public.account_files()),
  'games:brugame01/, media:avatars/b0000000-0000-0000-0000-000000000002/, media:covers/b0000000-0000-0000-0000-000000000002/, '
  || 'media:posts/55555555-5555-5555-5555-555555555503/, media:screenshots/11111111-1111-1111-1111-111111111103/, quarantine:11111111-1111-1111-1111-111111111103/',
  'and each person gets only their own'
);

-- ------------------------------------------------------------------ admins
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.delete_my_account() $$, 'P0001', 'admin_cannot_delete', 'an admin cannot delete their own account');
select tests.clear_authentication();
select is((select count(*) from auth.users where id = 'd0000000-0000-0000-0000-0000000000ad'), 1::bigint, 'and it is still there');

-- ------------------------------------------------------------------ deleting
select ok((select count(*) from public.notifications where actor_id = 'a0000000-0000-0000-0000-000000000001') > 0, 'ana had caused notifications (her follow, her comment, her like)');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.delete_my_account() $$, 'ana deletes her account');
select tests.clear_authentication();
select is((select count(*) from auth.users where id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'the sign-in is gone');
select is((select count(*) from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'and the profile');
select is((select count(*) from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'and her games');
select is((select count(*) from public.game_versions where game_id in ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111102')), 0::bigint, 'with their versions');
select is((select count(*) from public.posts where id in ('55555555-5555-5555-5555-555555555501', '55555555-5555-5555-5555-555555555502')), 0::bigint, 'and her updates');
select is((select count(*) from public.post_media where post_id = '55555555-5555-5555-5555-555555555501'), 0::bigint, 'with their media');
select is((select count(*) from public.comments where author_id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'and her comments');
select is((select count(*) from public.comments where id = '66666666-6666-6666-6666-666666666603'), 0::bigint, 'and the replies to them');
select is((select count(*) from public.comments where id = '66666666-6666-6666-6666-666666666602'), 0::bigint, 'and what others said on her games');
select is((select count(*) from public.game_likes where user_id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'and her likes');
select is((select count(*) from public.follows where follower_id = 'a0000000-0000-0000-0000-000000000001' or followee_id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'and the follows in both directions');
select is((select count(*) from public.notifications where actor_id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'and the notifications she caused, so nobody keeps one from «someone»');
select is((select count(*) from public.notifications where user_id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'and the ones she received');

select is((select count(*) from public.profiles where id = 'b0000000-0000-0000-0000-000000000002'), 1::bigint, 'bruno is untouched');
select is((select count(*) from public.games where id = '11111111-1111-1111-1111-111111111103'), 1::bigint, 'and so is his game');
select is((select count(*) from public.comments where id = '66666666-6666-6666-6666-666666666601'), 0::bigint, 'except the comment of ana on it, which was hers');
select is((select count(*) from public.posts where id = '55555555-5555-5555-5555-555555555503'), 1::bigint, 'his update stays');

select is((select count(*) from public.moderation_log where target_id = '11111111-1111-1111-1111-111111111101'), 1::bigint, 'the moderation log keeps its line');
select is((select count(*) || '|' || coalesce(max(game_id::text), 'null') from public.copyright_claims), '1|null', 'the copyright claim stays, no longer pointing at the deleted game');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.delete_my_account() $$, 'bruno can delete too');
select tests.clear_authentication();
select is((select count(*) from auth.users where id = 'b0000000-0000-0000-0000-000000000002'), 0::bigint, 'and his sign-in is gone');

select * from finish();
rollback;
