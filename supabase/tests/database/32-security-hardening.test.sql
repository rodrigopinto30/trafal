-- The security review of 2026-11-19 (docs/SEGURIDAD.md): what the database enforces by itself, so a direct call to the API with
-- the public key and a person's own session cannot skip what the web checks.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

insert into public.games (id, owner_id, public_id, title, short_description, genre_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'hidden01', 'Hidden game', 'A game', 'puzzle'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'draft02', 'Draft game', 'A game', 'puzzle'),
  ('11111111-1111-1111-1111-111111111103', 'a0000000-0000-0000-0000-000000000001', 'public03', 'Public game', 'A game', 'puzzle'),
  ('11111111-1111-1111-1111-111111111105', 'b0000000-0000-0000-0000-000000000002', 'bruno05', 'Bruno game', 'A game', 'puzzle');
insert into public.game_versions (id, game_id, number, label, status, quarantine_key, scan_flags) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v1', 'ready', null, '["PASSWORD_FIELD"]'::jsonb),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103', 1, 'v1', 'ready', null, '[]'::jsonb),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111103', 2, 'v2', 'uploading',
   '11111111-1111-1111-1111-111111111103/22222222-2222-2222-2222-222222222204.zip', '[]'::jsonb),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111105', 1, 'v1', 'ready', null, '[]'::jsonb);
insert into public.game_questions (game_id, position, question) values ('11111111-1111-1111-1111-111111111101', 1, 'Is it fun?');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222203', status = 'published', is_first_game = true where id = '11111111-1111-1111-1111-111111111103';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222205', status = 'published', is_first_game = true where id = '11111111-1111-1111-1111-111111111105';
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select public.moderate_content('game', '11111111-1111-1111-1111-111111111101', 'hide', 'Asks for passwords');
select tests.clear_authentication();

-- ------------------------------------------------------------------ a moderated game stays as moderation left it
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(tests.dml_count($$ update public.games set title = 'Rewritten', short_description = 'Clean now' where id = '11111111-1111-1111-1111-111111111101' $$), 0::bigint, 'the owner cannot rewrite a hidden game before appealing');
select is(tests.dml_count($$ update public.game_questions set question = 'Rewritten?' where game_id = '11111111-1111-1111-1111-111111111101' $$), 0::bigint, 'nor its questions');
select throws_ok($$ insert into public.game_questions (game_id, position, question) values ('11111111-1111-1111-1111-111111111101', 2, 'New one?') $$, '42501', null, 'nor add one');
select is(tests.dml_count($$ update public.game_versions set changelog = 'Nothing to see' where game_id = '11111111-1111-1111-1111-111111111101' $$), 0::bigint, 'nor rewrite its versions');
select throws_ok($$ select public.create_game_version('11111111-1111-1111-1111-111111111101', 1000) $$, 'P0001', 'game_not_found', 'nor upload a new version');
select throws_ok($$ select public.set_active_version('22222222-2222-2222-2222-222222222201') $$, 'P0001', 'version_not_found', 'nor switch the version people play');
select is(tests.dml_count($$ update public.games set title = 'Draft renamed' where id = '11111111-1111-1111-1111-111111111102' $$), 1::bigint, 'a draft of hers is still hers to change');

-- ------------------------------------------------------------------ deleting a game
select is(tests.dml_count($$ delete from public.games where id = '11111111-1111-1111-1111-111111111103' $$), 0::bigint, 'a game with versions cannot be deleted directly (its versions count toward the daily quota, its files live on)');
select is(tests.dml_count($$ delete from public.games where id = '11111111-1111-1111-1111-111111111102' $$), 1::bigint, 'one without versions can: the upload form undoes a failed upload that way');

-- ------------------------------------------------------------------ deleting the account needs a recent sign-in
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aud', 'authenticated',
  'amr', json_build_array(json_build_object('method', 'password', 'timestamp', floor(extract(epoch from now() - interval '1 hour'))::bigint)))::text, true);
select throws_ok($$ select public.delete_my_account() $$, '42501', 'reauthentication_required', 'a sign-in from an hour ago is not enough');
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aud', 'authenticated',
  'amr', '"password"')::text, true);
select throws_ok($$ select public.delete_my_account() $$, '42501', 'reauthentication_required', 'and a malformed list of methods counts as none');

-- ------------------------------------------------------------------ the internal state of a version is not public
select tests.authenticate_as_anon();
select throws_ok($$ select scan_flags from public.game_versions limit 1 $$, '42501', null, 'a visitor cannot read what the review flagged');
select throws_ok($$ select quarantine_key from public.game_versions limit 1 $$, '42501', null, 'nor where the zips are kept');
select throws_ok($$ select locked_by, attempts from public.game_versions limit 1 $$, '42501', null, 'nor the worker''s lock');
select is((select count(*) from public.game_versions where status = 'ready'), 2::bigint, 'the public part of the published versions is still readable (not the hidden game''s)');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select scan_flags from public.game_versions limit 1 $$, '42501', null, 'not even the owner reads the flags');
select results_eq(
  $$ select quarantine_key, declared_size_bytes from public.version_upload_target('22222222-2222-2222-2222-222222222204') $$,
  $$ values ('11111111-1111-1111-1111-111111111103/22222222-2222-2222-2222-222222222204.zip', null::bigint) $$,
  'the owner gets the upload target of a version that waits for its zip'
);
select is((select count(*) from public.version_upload_target('22222222-2222-2222-2222-222222222203')), 0::bigint, 'but not of one that already has it');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.version_upload_target('22222222-2222-2222-2222-222222222204')), 0::bigint, 'and nobody else gets it');

-- ------------------------------------------------------------------ the game of the week
select tests.clear_authentication();
insert into public.featured_games (week_start, game_id, chosen_by) values
  (date_trunc('week', current_date)::date, '11111111-1111-1111-1111-111111111103', 'd0000000-0000-0000-0000-0000000000ad'),
  (date_trunc('week', current_date)::date + 7, '11111111-1111-1111-1111-111111111105', 'd0000000-0000-0000-0000-0000000000ad');
select tests.authenticate_as_anon();
select is((select count(*) from public.featured_games), 1::bigint, 'a visitor sees this week''s pick and not next week''s');
select throws_ok($$ select chosen_by from public.featured_games $$, '42501', null, 'nor who chose it');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.featured_games), 2::bigint, 'an admin sees the weeks ahead');

-- ------------------------------------------------------------------ copyright claims need the web server's key
select tests.authenticate_as_anon();
create function pg_temp.claim(p_key text, p_name text default 'Carla Owner', p_original text default 'https://example.com/original', p_urls text[] default array['https://tradfal.example/games/public03'])
returns uuid language sql as $$
  select public.submit_copyright_claim(p_name, 'carla@example.com', null, 'My sprites', p_original, p_urls, true, true, 'Carla Owner',
    '11111111-1111-1111-1111-111111111103', null, p_key)
$$;
select throws_ok($$ select pg_temp.claim(null) $$, '42501', 'server_key_required', 'without the key, a direct call is refused even with a perfect claim');
select throws_ok($$ select pg_temp.claim('a-key-that-is-long-enough-but-wrong-0000') $$, '42501', 'server_key_required', 'and so is a wrong key');
select throws_ok($$ select pg_temp.claim(tests.claims_server_key(), p_original => 'javascript:alert(1)') $$, 'P0001', 'invalid_urls', 'the original work must be an http(s) link');
select throws_ok($$ select pg_temp.claim(tests.claims_server_key(), p_urls => array['data:text/html,hi']) $$, 'P0001', 'invalid_urls', 'and so must every claimed address');
select throws_ok($$ select pg_temp.claim(tests.claims_server_key(), p_name => 'Carla ' || chr(8238) || 'renwO') $$, 'P0001', 'invalid_text', 'names cannot hide direction-changing characters');
select lives_ok($$ select pg_temp.claim(tests.claims_server_key()) $$, 'with the key, a well-formed claim goes through');

-- ------------------------------------------------------------------ usernames that pass as the team
select tests.clear_authentication();
select is(public.username_available('tradfal_oficial'), false, 'a name with the site''s name is reserved');
select is(public.username_available('trafal.fan'), false, 'and with the old one');
select is(public.username_available('soporte_ya'), false, 'a part that means the team is reserved');
select is(public.username_available('ana.admin'), false, 'wherever it is');
select is(public.username_available('equipo_mateo'), false, 'including «equipo», the team''s own word');
select is(public.username_available('badminton_club'), true, 'but a word that merely contains one is fine');
select is(public.username_available('supporter'), true, 'and so is a longer word');
select tests.create_user('nuevo@tradfal.test', 'e0000000-0000-0000-0000-000000000005');
select tests.authenticate_as('e0000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.complete_onboarding('mi_tradfal', 'Nuevo', '2026-11-10', true, true) $$, 'P0001', 'reserved_username', 'onboarding refuses it too');
select throws_ok($$ select public.complete_onboarding('nuevo_ok', 'Nuevo' || chr(8203), '2026-11-10', true, true) $$, 'P0001', 'invalid_display_name', 'and a display name with an invisible character');

-- ------------------------------------------------------------------ public text is plain
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ update public.profiles set display_name = 'ana ' || chr(8238) || 'nimda' where id = 'a0000000-0000-0000-0000-000000000001' $$, '23514', null, 'a display name cannot flip the text around it');
select throws_ok($$ update public.profiles set display_name = chr(12644) where id = 'a0000000-0000-0000-0000-000000000001' $$, '23514', null, 'nor be made of a blank filler');
select throws_ok($$ update public.games set title = 'Public' || chr(173) || ' game' where id = '11111111-1111-1111-1111-111111111103' $$, '23514', null, 'a title cannot hide a soft hyphen to look like another one');
select throws_ok($$ update public.games set title = E'Two\nlines' where id = '11111111-1111-1111-1111-111111111103' $$, '23514', null, 'nor span two lines');
select lives_ok($$ update public.profiles set bio = E'Line one\nLine two, with a family: ' || chr(128104) || chr(8205) || chr(128105) || chr(8205) || chr(128103) where id = 'a0000000-0000-0000-0000-000000000001' $$, 'a bio keeps its line breaks and emoji joined with zero-width joiners');

select * from finish();
rollback;
