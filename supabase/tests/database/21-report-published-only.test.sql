-- Only published content can be reported: the copy kept as evidence is readable by the reporter.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

insert into public.games (id, owner_id, title, genre_id, is_first_game) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Juego publicado', 'puzzle', true),
  ('11111111-1111-1111-1111-111111111102', 'a0000000-0000-0000-0000-000000000001', 'Juego en borrador', 'arcade', false),
  ('11111111-1111-1111-1111-111111111103', 'a0000000-0000-0000-0000-000000000001', 'Juego oculto', 'arcade', false);
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v0.1', 'ready'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103', 1, 'v0.1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222203', status = 'published' where id = '11111111-1111-1111-1111-111111111103';
update public.games set status = 'hidden' where id = '11111111-1111-1111-1111-111111111103';
insert into public.posts (id, author_id, kind, body, status) values
  ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000001', 'avance', 'Avance publicado', 'published'),
  ('55555555-5555-5555-5555-555555555502', 'a0000000-0000-0000-0000-000000000001', 'avance', 'Avance oculto', 'hidden');
insert into public.comments (id, author_id, post_id, body, status) values
  ('66666666-6666-6666-6666-666666666601', 'a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555501', 'Comentario publicado', 'published'),
  ('66666666-6666-6666-6666-666666666602', 'a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555501', 'Comentario oculto', 'hidden');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'game', '11111111-1111-1111-1111-111111111101', 'spam') $$, 'se reporta un juego publicado');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'post', '55555555-5555-5555-5555-555555555501', 'spam') $$, 'se reporta un avance publicado');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'comment', '66666666-6666-6666-6666-666666666601', 'abuse') $$, 'se reporta un comentario publicado');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'profile', 'a0000000-0000-0000-0000-000000000001', 'other') $$, 'se reporta un perfil');

select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'game', '11111111-1111-1111-1111-111111111102', 'spam') $$, 'P0001', 'report_target_not_found', 'un juego en borrador no se reporta');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'game', '11111111-1111-1111-1111-111111111103', 'spam') $$, 'P0001', 'report_target_not_found', 'un juego oculto no se reporta');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'post', '55555555-5555-5555-5555-555555555502', 'spam') $$, 'P0001', 'report_target_not_found', 'un avance oculto no se reporta');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'comment', '66666666-6666-6666-6666-666666666602', 'spam') $$, 'P0001', 'report_target_not_found', 'un comentario oculto no se reporta');

select is((select count(*) from public.reports where snapshot::text like '%oculto%' or snapshot::text like '%borrador%'), 0::bigint, 'ninguna copia guarda texto de contenido no publicado');

select * from finish();
rollback;
