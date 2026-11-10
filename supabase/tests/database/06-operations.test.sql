-- Notificaciones, reportes, reclamos de copyright, juego de la semana, registro de moderación y partidas.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

-- Preparación (como el sistema): un juego publicado de ana (su primer juego), un avance, un comentario.
insert into public.games (id, owner_id, title, genre_id, engine_id, is_first_game) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Juego de Ana', 'puzzle', 'phaser', true),
  ('11111111-1111-1111-1111-111111111102', 'b0000000-0000-0000-0000-000000000002', 'Juego de Bruno', 'arcade', 'godot', false);
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v0.1', 'ready'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 1, 'v0.1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222202', status = 'published' where id = '11111111-1111-1111-1111-111111111102';
insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555501', 'a0000000-0000-0000-0000-000000000001', 'avance', 'Un avance de ana');
insert into public.comments (id, author_id, post_id, body) values
  ('66666666-6666-6666-6666-666666666601', 'b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555501', 'Un comentario de bruno');

-- =================================================================== NOTIFICACIONES
-- Los triggers ya avisaron del comentario de la preparación (se prueban en 23-notifications): acá se parte de cero.
delete from public.notifications;
insert into public.notifications (id, user_id, type, actor_id, post_id) values
  ('77777777-7777-7777-7777-777777777701', 'a0000000-0000-0000-0000-000000000001', 'comment', 'b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555501'),
  ('77777777-7777-7777-7777-777777777702', 'b0000000-0000-0000-0000-000000000002', 'follow', 'a0000000-0000-0000-0000-000000000001', null);

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.notifications), 1::bigint, 'ana solo ve sus notificaciones');
select is(tests.dml_count($$ update public.notifications set read_at = now() where id = '77777777-7777-7777-7777-777777777701' $$), 1::bigint, 'ana marca una como leída');
select is(tests.dml_count($$ update public.notifications set read_at = now() where id = '77777777-7777-7777-7777-777777777702' $$), 0::bigint, 'ana NO toca las de bruno');
select throws_ok($$ update public.notifications set type = 'moderation' where id = '77777777-7777-7777-7777-777777777701' $$, '42501', null, 'el contenido de una notificación no se edita');
select throws_ok($$ update public.notifications set user_id = 'b0000000-0000-0000-0000-000000000002' where id = '77777777-7777-7777-7777-777777777701' $$, '42501', null, 'ni se reasigna a otra persona');
select throws_ok($$ insert into public.notifications (user_id, type) values ('b0000000-0000-0000-0000-000000000002', 'like') $$, '42501', null, 'no se fabrican notificaciones para otras cuentas');
select is(tests.dml_count($$ delete from public.notifications where id = '77777777-7777-7777-7777-777777777702' $$), 0::bigint, 'ana NO descarta las de bruno');
select is(tests.dml_count($$ delete from public.notifications where id = '77777777-7777-7777-7777-777777777701' $$), 1::bigint, 'sí descarta las suyas');
select tests.authenticate_as_anon();
select throws_ok($$ select * from public.notifications $$, '42501', null, 'anon no lee notificaciones');

-- =================================================================== REPORTES
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason, detail) values ('b0000000-0000-0000-0000-000000000002', 'post', '55555555-5555-5555-5555-555555555501', 'spam', '  Es publicidad  ') $$, 'bruno reporta un avance');
select is((select snapshot ->> 'body' from public.reports), 'Un avance de ana', 'el reporte guarda una copia del contenido como evidencia');
select is((select detail from public.reports), 'Es publicidad', 'el detalle se guarda sin espacios sobrantes');
select is((select status from public.reports), 'open', 'nace abierto');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'post', '55555555-5555-5555-5555-555555555501', 'abuse') $$, '23505', null, 'no se reporta lo mismo dos veces mientras siga abierto');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'game', '11111111-1111-1111-1111-111111111101', 'broken') $$, 'reporta un juego que no funciona');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'comment', '66666666-6666-6666-6666-666666666601', 'abuse') $$, 'reporta un comentario');
select lives_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'profile', 'a0000000-0000-0000-0000-000000000001', 'other') $$, 'reporta un perfil');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'post', gen_random_uuid(), 'spam') $$, 'P0001', 'report_target_not_found', 'no se reporta algo que no existe');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-000000000002', 'game', '11111111-1111-1111-1111-111111111102', 'cualquiera') $$, '23514', null, 'motivo inválido');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('a0000000-0000-0000-0000-000000000001', 'game', '11111111-1111-1111-1111-111111111102', 'spam') $$, '42501', null, 'no se reporta a nombre de otra persona');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason, status) values ('b0000000-0000-0000-0000-000000000002', 'game', '11111111-1111-1111-1111-111111111102', 'spam', 'dismissed') $$, '42501', null, 'el estado lo gestiona la moderación');
select throws_ok($$ update public.reports set status = 'dismissed' $$, '42501', null, 'quien reporta no cierra su propio reporte');
select is((select count(*) from public.reports), 4::bigint, 'bruno ve sus 4 reportes');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.reports), 0::bigint, 'ana NO ve quién la reportó');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.reports), 4::bigint, 'la admin ve toda la cola');
select throws_ok($$ update public.reports set status = 'actioned' $$, '42501', null, 'y tampoco escribe por tabla: resolver pasa por funciones que dejan registro');
select tests.authenticate_as_anon();
select throws_ok($$ select * from public.reports $$, '42501', null, 'anon no lee reportes');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values (gen_random_uuid(), 'game', '11111111-1111-1111-1111-111111111101', 'spam') $$, '42501', null, 'anon no reporta');

-- La evidencia sobrevive aunque el contenido se edite o se borre.
select tests.clear_authentication();
delete from public.comments where id = '66666666-6666-6666-6666-666666666601';
select is((select snapshot ->> 'body' from public.reports where target_type = 'comment'), 'Un comentario de bruno', 'el reporte conserva el comentario aunque lo borren');

-- =================================================================== RECLAMOS DE COPYRIGHT
insert into public.copyright_claims (claimant_name, claimant_email, work_description, infringing_urls, statement_good_faith, statement_accuracy, signature)
values ('Estudio Pixel SRL', 'legales@estudiopixel.test', 'Los personajes de nuestro juego "Zorro Azul"', array['https://trafal.example/games/juego-de-ana'], true, true, 'María Gómez');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.copyright_claims), 0::bigint, 'una cuenta común no ve los reclamos');
select throws_ok($$ insert into public.copyright_claims (claimant_name, claimant_email, work_description, infringing_urls, statement_good_faith, statement_accuracy, signature) values ('X', 'x@x.test', 'una descripción larga', array['https://x.test'], true, true, 'X') $$, '42501', null, 'los reclamos no se crean por tabla (formulario público = función)');
select tests.authenticate_as_anon();
select throws_ok($$ select * from public.copyright_claims $$, '42501', null, 'anon no lee reclamos');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.copyright_claims), 1::bigint, 'la admin ve los reclamos');
select tests.clear_authentication();
select throws_ok($$ insert into public.copyright_claims (claimant_name, claimant_email, work_description, infringing_urls, statement_good_faith, statement_accuracy, signature) values ('X', 'x@x.test', 'una descripción larga', array['https://x.test'], false, true, 'X') $$, '23514', null, 'sin la declaración de buena fe no hay reclamo');
select throws_ok($$ insert into public.copyright_claims (claimant_name, claimant_email, work_description, infringing_urls, statement_good_faith, statement_accuracy, signature) values ('X', 'no-es-un-mail', 'una descripción larga', array['https://x.test'], true, true, 'X') $$, '23514', null, 'email inválido');

-- =================================================================== JUEGO DE LA SEMANA
select tests.authenticate_as_anon();
select is((select count(*) from public.featured_games), 0::bigint, 'todavía no hay destacado (lectura pública)');
select throws_ok($$ insert into public.featured_games (week_start, game_id) values ('2026-11-02', '11111111-1111-1111-1111-111111111101') $$, '42501', null, 'anon no elige destacados');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ insert into public.featured_games (week_start, game_id) values ('2026-11-02', '11111111-1111-1111-1111-111111111101') $$, '42501', null, 'ni siquiera la admin por tabla (hay una función que deja registro)');
select tests.clear_authentication();
select throws_ok($$ insert into public.featured_games (week_start, game_id) values ('2026-11-02', '11111111-1111-1111-1111-111111111102') $$, 'P0001', 'featured_requires_published_first_game', 'solo se destacan "primeros juegos"');
select throws_ok($$ insert into public.featured_games (week_start, game_id) values ('2026-11-03', '11111111-1111-1111-1111-111111111101') $$, '23514', null, 'la semana arranca un lunes');
select lives_ok($$ insert into public.featured_games (week_start, game_id, quote) values ('2026-11-02', '11111111-1111-1111-1111-111111111101', 'Es el primer juego que termino en mi vida.') $$, 'destacado válido');
select throws_ok($$ insert into public.featured_games (week_start, game_id) values ('2026-11-09', '11111111-1111-1111-1111-111111111101') $$, '23505', null, 'un juego no se destaca dos veces');
select tests.authenticate_as_anon();
select is((select count(*) from public.featured_games), 1::bigint, 'el destacado es público');

-- =================================================================== REGISTRO DE MODERACIÓN
select tests.clear_authentication();
insert into public.moderation_log (admin_id, admin_username, action, target_type, target_id, reason)
values ('d0000000-0000-0000-0000-0000000000ad', 'admina', 'hide_post', 'post', '55555555-5555-5555-5555-555555555501', 'spam confirmado');
select throws_ok($$ update public.moderation_log set reason = 'reescrito' $$, 'P0001', 'moderation_log_is_append_only', 'el registro no se reescribe (ni siquiera como superusuario)');
select throws_ok($$ delete from public.moderation_log $$, 'P0001', 'moderation_log_is_append_only', 'ni se borra');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.moderation_log), 0::bigint, 'una cuenta común no lo ve');
select throws_ok($$ insert into public.moderation_log (admin_id, admin_username, action, target_type) values ('a0000000-0000-0000-0000-000000000001', 'ana', 'x', 'post') $$, '42501', null, 'nadie escribe el registro por tabla');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.moderation_log where created_at = now()), 1::bigint, 'la admin lo lee');
select tests.authenticate_as_anon();
select throws_ok($$ select * from public.moderation_log $$, '42501', null, 'anon no lo lee');

-- =================================================================== PARTIDAS
select tests.clear_authentication();
insert into public.plays (game_id, version_id, user_id, session_id, device, active_seconds)
values ('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', 'b0000000-0000-0000-0000-000000000002', gen_random_uuid(), 'mobile', 95);
select throws_ok($$ insert into public.plays (game_id, session_id, device, active_seconds) values ('11111111-1111-1111-1111-111111111101', gen_random_uuid(), 'desktop', 99999) $$, '23514', null, 'tope de 4 horas por partida');
select throws_ok($$ insert into public.plays (game_id, session_id, device) values ('11111111-1111-1111-1111-111111111101', gen_random_uuid(), 'tv') $$, '23514', null, 'dispositivo inválido');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.plays), 0::bigint, 'ni quien jugó ve la tabla cruda (estadísticas = función)');
select throws_ok($$ insert into public.plays (game_id, session_id, device) values ('11111111-1111-1111-1111-111111111101', gen_random_uuid(), 'desktop') $$, '42501', null, 'las partidas no se inventan desde el cliente');
select throws_ok($$ update public.plays set active_seconds = 14400 $$, '42501', null, 'ni se inflan');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.plays), 0::bigint, 'ni siquiera la creadora lee las partidas crudas');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.plays), 1::bigint, 'solo la administración');
select tests.authenticate_as_anon();
select throws_ok($$ select * from public.plays $$, '42501', null, 'anon no lee partidas');

-- =================================================================== CATÁLOGOS
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ insert into public.genres (id) values ('nuevo') $$, '42501', null, 'los catálogos se cambian con migraciones, no desde la app (ni la admin)');
select throws_ok($$ update public.engines set sort = 0 $$, '42501', null, 'ni se reordenan');

select * from finish();
rollback;
