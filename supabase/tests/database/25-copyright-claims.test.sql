-- Copyright claims: anyone can send one through the function (nobody writes the table), it has to point at something on the site,
-- the form cannot flood the admins, only admins read and handle them, and handling is audited and reversible for the content.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

insert into public.games (id, owner_id, title, short_description, genre_id, engine_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Ana''s game', 'A game', 'puzzle', 'phaser'),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'Ana''s draft', 'x', 'puzzle', 'phaser');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000001', 'avance', 'An update of ana'),
  ('55555555-5555-5555-5555-555555555502', 'a0000000-0000-0000-0000-000000000001', 'avance', 'Another update');

create function pg_temp.claim(p_email text default 'owner@example.com', p_game uuid default '11111111-1111-1111-1111-111111111101', p_post uuid default null, p_good boolean default true, p_accurate boolean default true, p_urls text[] default array['https://trafal.example/games/abc']) returns uuid language sql as $$
  select public.submit_copyright_claim('Carla Owner', p_email, '  ', 'A sprite sheet I drew in 2024 and published on my site', 'https://example.com/original', p_urls, p_good, p_accurate, '  Carla Owner  ', p_game, p_post)
$$;
create function pg_temp.last_log() returns text language sql as $$
  select action || '|' || admin_username || '|' || target_type || '|' || target_id::text || '|' || coalesce(reason, 'null') from public.moderation_log order by id desc limit 1
$$;

-- ------------------------------------------------------------------ sending one
select tests.authenticate_as_anon();
select lives_ok($$ select pg_temp.claim() $$, 'a visitor with no account sends a claim');
select throws_ok($$ insert into public.copyright_claims (claimant_name, claimant_email, work_description, infringing_urls, statement_good_faith, statement_accuracy, signature) values ('x', 'x@example.com', 'a work description', array['u'], true, true, 'x') $$, '42501', null, 'but nobody writes the table directly');
select throws_ok($$ select * from public.copyright_claims $$, '42501', null, 'and a visitor does not read it');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.copyright_claims), 0::bigint, 'nor does an ordinary account (it sees none)');
select tests.clear_authentication();
select is((select claimant_name || '|' || claimant_email || '|' || coalesce(claimant_org, 'null') || '|' || signature || '|' || status || '|' || game_id::text from public.copyright_claims), 'Carla Owner|owner@example.com|null|Carla Owner|open|11111111-1111-1111-1111-111111111101', 'the claim is stored clean: trimmed, no empty organization, open, pointing at the game');

select tests.authenticate_as_anon();
select throws_ok($$ select pg_temp.claim(p_email => 'other@example.com', p_game => null, p_post => null) $$, 'P0001', 'claim_target_required', 'it has to point at a game or an update');
select throws_ok($$ select pg_temp.claim(p_email => 'other@example.com', p_game => gen_random_uuid()) $$, 'P0001', 'claim_target_not_found', 'which has to exist');
select throws_ok($$ select pg_temp.claim(p_email => 'other@example.com', p_game => '11111111-1111-1111-1111-111111111102') $$, 'P0001', 'claim_target_not_found', 'and not be a draft');
select throws_ok($$ select pg_temp.claim(p_email => 'other@example.com', p_good => false) $$, '23514', null, 'the statement of good faith is required');
select throws_ok($$ select pg_temp.claim(p_email => 'other@example.com', p_accurate => false) $$, '23514', null, 'and the one of accuracy');
select throws_ok($$ select pg_temp.claim(p_email => 'not-an-email') $$, '23514', null, 'the email has to look like one');
select throws_ok($$ select pg_temp.claim(p_email => 'other@example.com', p_urls => array[]::text[]) $$, '23514', null, 'at least one link');
select throws_ok($$ select pg_temp.claim(p_email => 'other@example.com', p_urls => array[repeat('x', 501)]) $$, 'P0001', 'invalid_urls', 'with a sensible length');
select lives_ok($$ select pg_temp.claim(p_email => 'other@example.com', p_game => null, p_post => '55555555-5555-5555-5555-555555555501') $$, 'a claim can be about an update');

-- ------------------------------------------------------------------ not a way to flood the admins
select lives_ok($$ select pg_temp.claim() $$, 'the same email sends a second claim');
select lives_ok($$ select pg_temp.claim() $$, 'and a third');
select throws_ok($$ select pg_temp.claim() $$, 'P0001', 'too_many_claims', 'the fourth in a day is refused');
select throws_ok($$ select pg_temp.claim('OWNER@Example.com') $$, 'P0001', 'too_many_claims', 'whatever the capital letters');
select lives_ok($$ select pg_temp.claim(p_email => 'someone.else@example.com') $$, 'another email is not affected');
select tests.clear_authentication();
insert into public.copyright_claims (claimant_name, claimant_email, work_description, infringing_urls, statement_good_faith, statement_accuracy, signature, game_id)
  select 'n', 'bulk' || n || '@example.com', 'a work description', array['u'], true, true, 's', '11111111-1111-1111-1111-111111111101' from generate_series(1, 60) n;
select tests.authenticate_as_anon();
select throws_ok($$ select pg_temp.claim(p_email => 'late@example.com') $$, 'P0001', 'too_many_claims', 'and the site as a whole takes 60 an hour');
select tests.clear_authentication();
delete from public.copyright_claims where claimant_email like 'bulk%';

-- ------------------------------------------------------------------ who handles them
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.take_claim((select id from public.copyright_claims limit 1)) $$, '42501', 'not_admin', 'an ordinary account cannot take one');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select cmp_ok((select count(*) from public.copyright_claims), '>=', 4::bigint, 'an admin reads them');
create temporary table claim_ids on commit drop as
  select
    (select id from public.copyright_claims where claimant_email = 'other@example.com') as about_post,
    (select id from public.copyright_claims where claimant_email = 'someone.else@example.com') as about_game,
    (select id from public.copyright_claims where claimant_email = 'owner@example.com' order by created_at, id limit 1) as to_dismiss;
grant select on claim_ids to authenticated;

select lives_ok($$ select public.take_claim((select about_game from claim_ids)) $$, 'the admin takes a claim');
select is((select status from public.copyright_claims where id = (select about_game from claim_ids)), 'reviewing', 'which goes to reviewing');
select is(pg_temp.last_log(), 'take_claim|admina|claim|' || (select about_game::text from claim_ids) || '|null', 'and it is logged');
select throws_ok($$ select public.take_claim((select about_game from claim_ids)) $$, 'P0001', 'claim_not_open', 'it cannot be taken twice');

select lives_ok($$ select public.resolve_claim((select to_dismiss from claim_ids), 'dismissed', '  Not the same work  ') $$, 'the admin dismisses one');
select is((select status || '|' || handled_by::text || '|' || resolution_note from public.copyright_claims where id = (select to_dismiss from claim_ids)), 'dismissed|d0000000-0000-0000-0000-0000000000ad|Not the same work', 'with who, and the note, trimmed');
select throws_ok($$ select public.resolve_claim((select to_dismiss from claim_ids), 'actioned', null) $$, 'P0001', 'claim_already_resolved', 'a resolved claim is not resolved again');
select is((select status from public.games where id = '11111111-1111-1111-1111-111111111101'), 'published', 'dismissing leaves the game as it is');

select throws_ok($$ select public.resolve_claim((select about_game from claim_ids), 'hide_content', '   ') $$, 'P0001', 'reason_required', 'hiding needs a reason');
select throws_ok($$ select public.resolve_claim((select about_game from claim_ids), 'delete', 'x') $$, 'P0001', 'invalid_outcome', 'there is no way to delete');
select lives_ok($$ select public.resolve_claim((select about_game from claim_ids), 'hide_content', 'Copyright claim accepted') $$, 'hiding what was claimed and resolving');
select is((select status from public.games where id = '11111111-1111-1111-1111-111111111101'), 'hidden', 'the game is hidden');
select is((select status from public.copyright_claims where id = (select about_game from claim_ids)), 'actioned', 'and the claim is actioned');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select data ->> 'reason' || '|' || (data ->> 'action') || '|' || (data ->> 'target_type') from public.notifications where type = 'moderation' and game_id = '11111111-1111-1111-1111-111111111101'), 'Copyright claim accepted|hide|game', 'its creator is told, with the reason');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.moderation_log where action in ('hide_game', 'action_claim') and created_at = now()), 2::bigint, 'the hiding and the resolution are both in the log');

select lives_ok($$ select public.resolve_claim((select about_post from claim_ids), 'hide_content', 'Copyright claim accepted') $$, 'a claim about an update hides the update');
select is((select status from public.posts where id = '55555555-5555-5555-5555-555555555501'), 'hidden', 'and it is hidden');
select throws_ok($$ select public.resolve_claim((select about_game from claim_ids), 'hide_content', 'again') $$, 'P0001', 'claim_already_resolved', 'a resolved claim stays resolved');

select tests.clear_authentication();
insert into public.copyright_claims (id, claimant_name, claimant_email, work_description, infringing_urls, statement_good_faith, statement_accuracy, signature, game_id)
  values ('99999999-9999-9999-9999-999999999999', 'n', 'again@example.com', 'a work description', array['u'], true, true, 's', '11111111-1111-1111-1111-111111111101');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.resolve_claim('99999999-9999-9999-9999-999999999999', 'hide_content', 'it is already hidden') $$, 'P0001', 'nothing_to_hide', 'there is nothing to hide when what was claimed is not published');
select lives_ok($$ select public.resolve_claim('99999999-9999-9999-9999-999999999999', 'actioned', 'Handled directly with the author') $$, 'but it can be marked as handled');
select throws_ok($$ select public.resolve_claim(gen_random_uuid(), 'dismissed', null) $$, 'P0001', 'claim_not_found', 'and a claim that does not exist is not found');

select * from finish();
rollback;
