-- Usage limits: counted by the database, per person and window, only for signed-in people; admins and the system are not limited;
-- a refused or invalid action leaves nothing behind; the log of events is nobody's to read or write.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555501', 'b0000000-0000-0000-0000-000000000002', 'avance', 'An update of bruno');

create function pg_temp.refusal(p_sql text) returns text language plpgsql as $$
declare
  v_message text;
  v_detail text;
  v_hint text;
begin
  execute p_sql;
  return 'allowed';
exception when others then
  get stacked diagnostics v_message = message_text, v_detail = pg_exception_detail, v_hint = pg_exception_hint;
  return v_message || '|' || coalesce(v_detail, '') || '|' || coalesce(v_hint, '');
end;
$$;
create function pg_temp.events(p_user uuid, p_action text) returns bigint language sql security definer as $$
  select count(*) from public.usage_events where user_id = p_user and action = p_action
$$;
create function pg_temp.comment_sql(p_author uuid) returns text language sql as $$
  select format($q$ insert into public.comments (author_id, post_id, body) values (%L, '55555555-5555-5555-5555-555555555501', 'A comment') $q$, p_author)
$$;

-- ------------------------------------------------------------------ the per-minute limit of comments
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.comments (author_id, post_id, body) select 'a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555501', 'Comment ' || n from generate_series(1, 8) n $$, 'ana comments 8 times in a minute');
select is(pg_temp.events('a0000000-0000-0000-0000-000000000001', 'comment'), 8::bigint, 'and each one is counted');
select is(split_part(pg_temp.refusal(pg_temp.comment_sql('a0000000-0000-0000-0000-000000000001')), '|', 1), 'usage_limit_exceeded', 'the ninth is refused');
select is(split_part(pg_temp.refusal(pg_temp.comment_sql('a0000000-0000-0000-0000-000000000001')), '|', 2), 'comment', 'saying which action');
select ok(split_part(pg_temp.refusal(pg_temp.comment_sql('a0000000-0000-0000-0000-000000000001')), '|', 3)::integer between 1 and 60, 'and in how many seconds a slot frees up');
select is(pg_temp.events('a0000000-0000-0000-0000-000000000001', 'comment'), 8::bigint, 'a refusal does not count');
select is((select count(*) from public.comments where author_id = 'a0000000-0000-0000-0000-000000000001'), 8::bigint, 'and nothing was written');
select lives_ok($$ insert into public.posts (author_id, kind, body) values ('a0000000-0000-0000-0000-000000000001', 'avance', 'An update') $$, 'a limit of comments does not stop her from posting');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ insert into public.comments (author_id, post_id, body) values ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555501', 'Bruno comments') $$, 'and it is per person: bruno is not affected');

-- ------------------------------------------------------------------ who is not limited
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ insert into public.comments (author_id, post_id, body) select 'd0000000-0000-0000-0000-0000000000ad', '55555555-5555-5555-5555-555555555501', 'Admin ' || n from generate_series(1, 12) n $$, 'an admin is not limited');
select is(pg_temp.events('d0000000-0000-0000-0000-0000000000ad', 'comment'), 0::bigint, 'and leaves nothing in the log');
select tests.clear_authentication();
select lives_ok($$ insert into public.comments (author_id, post_id, body) select 'a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555501', 'System ' || n from generate_series(1, 12) n $$, 'the system (no signed-in person: seeds, the worker) is not limited either');
select is(pg_temp.events('a0000000-0000-0000-0000-000000000001', 'comment'), 8::bigint, 'and is not counted');

-- ------------------------------------------------------------------ windows
update public.usage_events set created_at = now() - interval '2 minutes' where user_id = 'a0000000-0000-0000-0000-000000000001' and action = 'comment';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok(pg_temp.comment_sql('a0000000-0000-0000-0000-000000000001'), 'two minutes later the minute window is clear and she can comment again');

select tests.clear_authentication();
delete from public.usage_events where user_id = 'a0000000-0000-0000-0000-000000000001';
insert into public.usage_events (user_id, action, created_at) select 'a0000000-0000-0000-0000-000000000001', 'comment', now() - interval '1 hour' from generate_series(1, 150);
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.refusal(pg_temp.comment_sql('a0000000-0000-0000-0000-000000000001')), 'usage_limit_exceeded|comment|82800', 'the daily window counts too: 150 an hour ago leaves 23 hours to wait');

select tests.clear_authentication();
delete from public.usage_events where user_id = 'a0000000-0000-0000-0000-000000000001';
insert into public.usage_events (user_id, action, created_at) values ('a0000000-0000-0000-0000-000000000001', 'comment', now() - interval '3 days');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok(pg_temp.comment_sql('a0000000-0000-0000-0000-000000000001'), 'she comments');
select is(pg_temp.events('a0000000-0000-0000-0000-000000000001', 'comment'), 1::bigint, 'and events of more than two days ago are swept away');

-- ------------------------------------------------------------------ invalid attempts
select tests.clear_authentication();
delete from public.usage_events where user_id = 'a0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(split_part(pg_temp.refusal($$ insert into public.comments (author_id, post_id, body) values ('a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555501', '   ') $$), '|', 1) <> 'allowed', true, 'an empty comment is refused');
select is(pg_temp.events('a0000000-0000-0000-0000-000000000001', 'comment'), 0::bigint, 'and does not use up the limit');

-- ------------------------------------------------------------------ asking without doing
select tests.clear_authentication();
insert into public.usage_events (user_id, action) select 'a0000000-0000-0000-0000-000000000001', 'comment' from generate_series(1, 8);
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(split_part(pg_temp.refusal($$ select public.check_usage('comment') $$), '|', 1), 'usage_limit_exceeded', 'check_usage refuses when she is at the limit');
select lives_ok($$ select public.check_usage('post') $$, 'and answers yes when she is not');
select is(pg_temp.events('a0000000-0000-0000-0000-000000000001', 'post'), 0::bigint, 'asking records nothing');
select throws_ok($$ select public.check_usage('dance') $$, 'P0001', 'unknown_action', 'an action that is not limited is not a question');
select tests.authenticate_as_anon();
select throws_ok($$ select public.check_usage('post') $$, '42501', null, 'a visitor cannot ask');

-- ------------------------------------------------------------------ the log is nobody's
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select * from public.usage_events $$, '42501', null, 'nobody reads the log of events');
select throws_ok($$ insert into public.usage_events (user_id, action) values ('a0000000-0000-0000-0000-000000000001', 'x') $$, '42501', null, 'nobody writes it');
select throws_ok($$ delete from public.usage_events $$, '42501', null, 'nobody empties it to start again');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select * from public.usage_events $$, '42501', null, 'not even an admin');

-- ------------------------------------------------------------------ profile photos
select tests.clear_authentication();
delete from public.usage_events where user_id = 'b0000000-0000-0000-0000-000000000002';
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ update public.profiles set bio = 'Changed bio' where id = 'b0000000-0000-0000-0000-000000000002' $$, 'changing the bio is not limited');
select lives_ok($$ do $b$ begin for n in 1..10 loop update public.profiles set avatar_path = 'avatars/b0000000-0000-0000-0000-000000000002/' || lpad(to_hex(n), 32, '0') || '.webp' where id = 'b0000000-0000-0000-0000-000000000002'; end loop; end $b$ $$, 'changing the photo 10 times in a day is fine');
select is(split_part(pg_temp.refusal($$ update public.profiles set avatar_path = 'avatars/b0000000-0000-0000-0000-000000000002/' || repeat('f', 32) || '.webp' where id = 'b0000000-0000-0000-0000-000000000002' $$), '|', 1), 'usage_limit_exceeded', 'the eleventh is refused');
select lives_ok($$ update public.profiles set avatar_path = avatar_path where id = 'b0000000-0000-0000-0000-000000000002' $$, 'saving the same photo again is not a change');
select lives_ok($$ update public.profiles set avatar_path = null where id = 'b0000000-0000-0000-0000-000000000002' $$, 'and neither is taking it off');

-- ------------------------------------------------------------------ every limited table has its trigger
select tests.clear_authentication();
select has_trigger('public', 'comments', 'comments_usage', 'comments');
select has_trigger('public', 'posts', 'posts_usage', 'posts');
select has_trigger('public', 'reports', 'reports_usage', 'reports');
select has_trigger('public', 'follows', 'follows_usage', 'follows');
select has_trigger('public', 'game_likes', 'game_likes_usage', 'game likes');
select has_trigger('public', 'post_likes', 'post_likes_usage', 'update likes');
select has_trigger('public', 'game_saves', 'game_saves_usage', 'game saves');
select has_trigger('public', 'post_saves', 'post_saves_usage', 'update saves');
select has_trigger('public', 'games', 'games_usage', 'games');
select has_trigger('public', 'profiles', 'profiles_avatar_usage', 'profile photos');

select * from finish();
rollback;
