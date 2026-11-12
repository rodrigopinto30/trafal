-- The first game of the week: only an admin chooses it, only through the audited functions, only a published first game, and every change leaves a line in the append-only log.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');
select tests.create_profile('e0000000-0000-0000-0000-000000000005', 'diego');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

insert into public.games (id, owner_id, title, genre_id, is_first_game) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'First A', 'puzzle', true),
  ('11111111-1111-1111-1111-111111111102', 'b0000000-0000-0000-0000-000000000002', 'First B', 'puzzle', true),
  ('11111111-1111-1111-1111-111111111103', 'a0000000-0000-0000-0000-000000000001', 'Not first', 'puzzle', false),
  ('11111111-1111-1111-1111-111111111104', 'e0000000-0000-0000-0000-000000000005', 'First draft', 'puzzle', true),
  ('11111111-1111-1111-1111-111111111105', 'c0000000-0000-0000-0000-000000000003', 'First C', 'puzzle', true);
insert into public.game_versions (id, game_id, number, label, status)
select ('22222222-2222-2222-2222-2222222222' || right(g.id::text, 2))::uuid, g.id, 1, 'v1', 'ready' from public.games g where g.title <> 'First draft';
update public.games g set active_version_id = v.id, status = 'published' from public.game_versions v where v.game_id = g.id;

create function pg_temp.this_week() returns date language sql as $$ select date_trunc('week', current_date)::date $$;

-- ------------------------------------------------------------------ an admin chooses
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is(public.set_featured_game('11111111-1111-1111-1111-111111111101', null, '  A lovely first game  '), pg_temp.this_week(), 'the admin chooses a game for the current week, and gets the week back');
select is((select game_id::text || '|' || quote || '|' || (chosen_by = 'd0000000-0000-0000-0000-0000000000ad')::text from public.featured_games where week_start = pg_temp.this_week()), '11111111-1111-1111-1111-111111111101|A lovely first game|true', 'it is saved with the trimmed quote and who chose it');
select is((select action || '|' || admin_username || '|' || target_type || '|' || target_id::text || '|' || reason from public.moderation_log order by id desc limit 1), 'feature_game|admina|featured|11111111-1111-1111-1111-111111111101|week ' || pg_temp.this_week(), 'and the log says who, what and which game');

select is(public.set_featured_game('11111111-1111-1111-1111-111111111102', null, '   '), pg_temp.this_week(), 'choosing again for the same week replaces the pick');
select is((select game_id::text || '|' || coalesce(quote, 'null') from public.featured_games where week_start = pg_temp.this_week()), '11111111-1111-1111-1111-111111111102|null', 'with an empty quote saved as nothing');
select is((select action from public.moderation_log order by id desc limit 1), 'replace_featured_game', 'and the log calls it a replacement');
select is((select count(*) from public.featured_games), 1::bigint, 'there is still one pick for the week');

select lives_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111101', null, null) $$, 'a game that was replaced can come back');
select is((select count(*) from public.moderation_log where created_at = now()), 3::bigint, 'each change is one line of the log');

-- ------------------------------------------------------------------ the week
select lives_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111105', pg_temp.this_week() + 7, 'Next week') $$, 'a coming week can be chosen ahead');
select is((select count(*) from public.featured_games), 2::bigint, 'it is another pick');
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111102', pg_temp.this_week() + 1) $$, 'P0001', 'week_not_monday', 'a week has to start on a Monday');
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111102', pg_temp.this_week() - 7) $$, 'P0001', 'week_in_the_past', 'a past week is history');
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111102', pg_temp.this_week() + 70) $$, 'P0001', 'week_too_far', 'and so many weeks ahead is too far');

-- ------------------------------------------------------------------ what can be featured
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111103', pg_temp.this_week() + 14) $$, 'P0001', 'featured_requires_published_first_game', 'a game that is not a first game cannot');
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111104', pg_temp.this_week() + 14) $$, 'P0001', 'featured_requires_published_first_game', 'nor can a draft');
select throws_ok($$ select public.set_featured_game(gen_random_uuid(), pg_temp.this_week() + 14) $$, 'P0001', 'featured_requires_published_first_game', 'nor a game that does not exist');
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111105', pg_temp.this_week() + 14) $$, 'P0001', 'game_already_featured', 'a game is featured only once in its life, even in another week');
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111102', pg_temp.this_week() + 14, repeat('x', 281)) $$, '23514', null, 'a quote over 280 characters is refused');
select is((select count(*) from public.moderation_log where created_at = now()), 4::bigint, 'and a failed attempt leaves nothing in the log');

-- ------------------------------------------------------------------ taking a pick off
select is(public.clear_featured_game(pg_temp.this_week() + 7), true, 'the admin takes off the pick of a coming week');
select is((select action || '|' || target_id::text from public.moderation_log order by id desc limit 1), 'unfeature_game|11111111-1111-1111-1111-111111111105', 'and the log says so');
select is(public.clear_featured_game(pg_temp.this_week() + 7), false, 'taking off a week with no pick does nothing');
select is((select count(*) from public.moderation_log where created_at = now()), 5::bigint, 'and is not logged');
select throws_ok($$ select public.clear_featured_game(pg_temp.this_week() - 7) $$, 'P0001', 'week_in_the_past', 'past picks cannot be taken off');
select is(public.clear_featured_game(), true, 'without a week it is the current one');
select is((select count(*) from public.featured_games), 0::bigint, 'nothing is featured now');

-- ------------------------------------------------------------------ nobody else, no other way
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111101') $$, '42501', 'not_admin', 'a creator cannot choose, not even their own game');
select throws_ok($$ select public.clear_featured_game() $$, '42501', 'not_admin', 'nor take a pick off');
select throws_ok($$ insert into public.featured_games (week_start, game_id) values (pg_temp.this_week() + 21, '11111111-1111-1111-1111-111111111101') $$, '42501', null, 'there is no way around the function through the table');
select is((select count(*) from public.moderation_log where created_at = now()), 0::bigint, 'and the log is not readable by them');

select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ insert into public.featured_games (week_start, game_id) values (pg_temp.this_week() + 21, '11111111-1111-1111-1111-111111111101') $$, '42501', null, 'not even an admin writes the table directly');
select throws_ok($$ update public.moderation_log set reason = 'rewritten' $$, '42501', null, 'nor edits the log');
select throws_ok($$ delete from public.moderation_log $$, '42501', null, 'nor erases it');
select is((select count(*) from public.moderation_log where created_at = now()), 6::bigint, 'the admin reads the whole log');

select tests.authenticate_as_anon();
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111101') $$, '42501', null, 'anon cannot choose');
select is((select count(*) from public.featured_games), 0::bigint, 'but anyone can read the picks');

select tests.clear_authentication();
update public.profile_private set status = 'suspended' where id = 'd0000000-0000-0000-0000-0000000000ad';
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111101') $$, '42501', 'not_admin', 'a suspended admin cannot choose either');

-- ------------------------------------------------------------------ deleting the account of the admin who chose
select tests.clear_authentication();
select tests.create_profile('d1000000-0000-0000-0000-0000000000ad', 'admin2', 'admin');
select tests.authenticate_as('d1000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.set_featured_game('11111111-1111-1111-1111-111111111101') $$, 'another admin chooses');
select tests.clear_authentication();
select lives_ok($$ delete from auth.users where id = 'd1000000-0000-0000-0000-0000000000ad' $$, 'and deleting their account works');
select is((select chosen_by from public.featured_games where week_start = pg_temp.this_week()), null, 'the pick stays, with nobody as the one who chose it');
select is((select count(*) from public.moderation_log where created_at = now() and admin_username = 'admin2'), 1::bigint, 'and the log keeps their line');

select * from finish();
rollback;
