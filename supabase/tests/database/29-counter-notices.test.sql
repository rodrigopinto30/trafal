-- Counter-notices: only content hidden because of a copyright claim has this path, a plain appeal is refused for it, the person has to
-- state their name, an email and the two statements, the claimant's details never reach the person, and an admin keeps it hidden or
-- restores it with an answer.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

insert into public.games (id, owner_id, title, short_description, genre_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Ana''s game', 'A nice game', 'puzzle'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'Ana''s second game', 'Another', 'puzzle');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v1', 'ready'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 1, 'v1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222202', status = 'published' where id = '11111111-1111-1111-1111-111111111102';
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000001', 'avance', 'An update of ana');

create function pg_temp.claim(p_game uuid, p_post uuid) returns uuid language sql as $$
  select public.submit_copyright_claim('Carla Owner', 'carla' || (random() * 100000)::int || '@example.com', null, 'A sprite sheet I drew', null, array['https://trafal.example/x'], true, true, 'Carla Owner', p_game, p_post)
$$;

select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select public.resolve_claim(pg_temp.claim('11111111-1111-1111-1111-111111111101', null), 'hide_content', 'The sprites are not hers');
select public.resolve_claim(pg_temp.claim(null, '55555555-5555-5555-5555-555555555501'), 'hide_content', 'The art is not hers either');
select public.moderate_content('game', '11111111-1111-1111-1111-111111111102', 'hide', 'Hidden for another reason');
select tests.clear_authentication();

-- ------------------------------------------------------------------ what comes from a claim
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(
  (select string_agg(target_type || ':' || label || ':' || copyright::text, ', ' order by target_type, label) from public.my_decisions()),
  'game:Ana''s game:true, game:Ana''s second game:false, post:An update of ana:true',
  'what was hidden because of a claim is flagged, and what was hidden for another reason is not'
);

select throws_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111101', 'It is mine') $$, 'P0001', 'counter_notice_required', 'a plain appeal is refused for content hidden by a claim');
select lives_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111102', 'The other one is fine') $$, 'but it still works for what was hidden for another reason');
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111102', 'It is mine', 'Ana Maker', 'ana@example.com', true, true) $$, 'P0001', 'already_appealed', 'and that one cannot also get a counter-notice');

-- ------------------------------------------------------------------ the counter-notice
select tests.authenticate_as_anon();
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', 'It is mine', 'Ana Maker', 'ana@example.com', true, true) $$, '42501', null, 'a visitor cannot send one');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', 'It is mine', 'Bruno', 'bruno@example.com', true, true) $$, 'P0001', 'nothing_to_appeal', 'nobody sends one for something of somebody else');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', '  ', 'Ana Maker', 'ana@example.com', true, true) $$, 'P0001', 'message_required', 'it needs to say why');
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', 'It is mine', '  ', 'ana@example.com', true, true) $$, 'P0001', 'name_required', 'it needs a name');
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', 'It is mine', 'Ana Maker', 'not an email', true, true) $$, 'P0001', 'invalid_email', 'and an email that looks like one');
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', 'It is mine', 'Ana Maker', 'ana@example.com', false, true) $$, 'P0001', 'statements_required', 'the good-faith statement must be made');
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', 'It is mine', 'Ana Maker', 'ana@example.com', true, null) $$, 'P0001', 'statements_required', 'and the accuracy one');
select throws_ok($$ select public.submit_counter_notice('comment', '11111111-1111-1111-1111-111111111101', 'It is mine', 'Ana Maker', 'ana@example.com', true, true) $$, 'P0001', 'invalid_target_type', 'only games and updates can be claimed');

select lives_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', '  I drew it myself  ', '  Ana Maker  ', '  ana@example.com ', true, true) $$, 'ana sends the counter-notice');
select is(
  (select kind || '|' || status || '|' || message || '|' || counter_name || '|' || counter_email || '|' || (claim_id is not null)::text from public.appeals where target_id = '11111111-1111-1111-1111-111111111101'),
  'counter_notice|open|I drew it myself|Ana Maker|ana@example.com|true',
  'it is stored open, trimmed, and linked to the claim'
);
select is((select decision_reason from public.appeals where target_id = '11111111-1111-1111-1111-111111111101'), 'The sprites are not hers', 'with the reason it was hidden');
select is((select copyright::text || '|' || appeal_status from public.my_decisions() where label = 'Ana''s game'), 'true|open', 'and the decision shows it as open');
select throws_ok($$ select public.submit_counter_notice('game', '11111111-1111-1111-1111-111111111101', 'Again', 'Ana Maker', 'ana@example.com', true, true) $$, 'P0001', 'already_appealed', 'only one per decision');
select throws_ok($$ select public.submit_appeal('game', '11111111-1111-1111-1111-111111111101', 'Again') $$, 'P0001', 'already_appealed', 'and not a plain appeal on top');
select throws_ok($$ insert into public.appeals (appellant_id, target_type, target_id, message, kind) values ('a0000000-0000-0000-0000-000000000001', 'game', '11111111-1111-1111-1111-111111111102', 'x', 'counter_notice') $$, '42501', null, 'nobody writes appeals directly');

-- ------------------------------------------------------------------ the claimant's details stay with the admins
select is((select count(*) from public.copyright_claims), 0::bigint, 'ana cannot read any claim');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is(
  (select c.claimant_name from public.appeals a join public.copyright_claims c on c.id = a.claim_id where a.kind = 'counter_notice'),
  'Carla Owner',
  'but the admin reads the claim next to the counter-notice'
);

-- ------------------------------------------------------------------ answering
select lives_ok($$ select public.resolve_appeal((select id from public.appeals where kind = 'counter_notice'), 'upheld', 'The claimant sent proof') $$, 'the admin keeps the content hidden');
select is((select status from public.games where id = '11111111-1111-1111-1111-111111111101'), 'hidden', 'it stays hidden');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(
  (select data ->> 'action' || '|' || (data ->> 'kind') || '|' || (data ->> 'note') from public.notifications where type = 'moderation' and data ->> 'action' like 'appeal_%' and game_id = '11111111-1111-1111-1111-111111111101'),
  'appeal_upheld|counter_notice|The claimant sent proof',
  'ana reads the answer, marked as the answer to a counter-notice'
);

select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'game' and kind = 'appeal'), 'overturned', '  ') $$, 'P0001', 'reason_required', 'a plain appeal is still answered with a note');
select lives_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'game' and kind = 'appeal'), 'overturned', 'Fine after all') $$, 'and a plain appeal is still resolved as before');
select is((select status from public.games where id = '11111111-1111-1111-1111-111111111102'), 'published', 'republishing the game');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.submit_counter_notice('post', '55555555-5555-5555-5555-555555555501', 'The art is mine', 'Ana Maker', 'ana@example.com', true, true) $$, 'the update hidden by a claim gets its own counter-notice');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.resolve_appeal((select id from public.appeals where target_type = 'post'), 'overturned', 'The proof is hers') $$, 'which the admin accepts');
select is((select status from public.posts where id = '55555555-5555-5555-5555-555555555501'), 'published', 'the update is published again');
select is((select action || '|' || coalesce(reason, '') from public.moderation_log where target_type = 'post' order by id desc limit 1), 'restore_post|Counter-notice: The proof is hers', 'and the log says it came from a counter-notice');

select * from finish();
rollback;
