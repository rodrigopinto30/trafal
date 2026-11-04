-- Avances, archivos, comentarios, me gusta y guardados.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

-- Preparación (como el sistema): un juego publicado de ana y otro de bruno, y una pregunta de feedback.
insert into public.games (id, owner_id, title, genre_id, engine_id) values
  ('11111111-1111-1111-1111-111111111101', 'a0000000-0000-0000-0000-000000000001', 'Juego de Ana', 'puzzle', 'phaser'),
  ('11111111-1111-1111-1111-111111111102', 'b0000000-0000-0000-0000-000000000002', 'Juego de Bruno', 'arcade', 'godot');
insert into public.game_versions (id, game_id, number, label, status) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'v0.1', 'ready'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 1, 'v0.1', 'ready');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222201', status = 'published' where id = '11111111-1111-1111-1111-111111111101';
update public.games set active_version_id = '22222222-2222-2222-2222-222222222202', status = 'published' where id = '11111111-1111-1111-1111-111111111102';
insert into public.game_questions (id, game_id, position, question) values
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111101', 1, '¿Se entiende el objetivo?');
-- Un avance ya moderado (oculto) de la admin, con id conocido: para las cuentas comunes es "ajeno y
-- oculto", así se prueba que no se puede comentar, dar me gusta ni guardar.
insert into public.posts (id, author_id, kind, body, status) values
  ('55555555-5555-5555-5555-555555555501', 'd0000000-0000-0000-0000-0000000000ad', 'avance', 'Avance oculto', 'hidden');

-- =================================================================== AVANCES
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.posts (author_id, kind, body) values ('a0000000-0000-0000-0000-000000000001', 'avance', '  Día 12: agregué sonidos  ') $$, 'ana publica un avance');
select is((select body from public.posts), 'Día 12: agregué sonidos', 'el texto se guarda sin espacios sobrantes');
select lives_ok($$ insert into public.posts (author_id, kind, body, game_id, version_id) values ('a0000000-0000-0000-0000-000000000001', 'avance', 'Salió la v0.1', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201') $$, 'avance que anuncia una versión de su juego');
select lives_ok($$ insert into public.posts (author_id, kind, body, game_id) values ('a0000000-0000-0000-0000-000000000001', 'pide_feedback', '¿Pueden probarlo?', '11111111-1111-1111-1111-111111111101') $$, 'pide feedback sobre su juego');
select lives_ok($$ insert into public.posts (author_id, kind, body, highlight) values ('a0000000-0000-0000-0000-000000000001', 'hito', 'No lo puedo creer.', '100') $$, 'publica un hito');
select throws_ok($$ insert into public.posts (author_id, kind, body, game_id) values ('a0000000-0000-0000-0000-000000000001', 'avance', 'robando el juego de bruno', '11111111-1111-1111-1111-111111111102') $$, 'P0001', 'game_not_owned', 'no se puede vincular el juego de otra persona');
select throws_ok($$ insert into public.posts (author_id, kind, body, game_id, version_id) values ('a0000000-0000-0000-0000-000000000001', 'avance', 'versión ajena', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222202') $$, '23503', null, 'ni anunciar una versión de otro juego');
select throws_ok($$ insert into public.posts (author_id, kind, body) values ('a0000000-0000-0000-0000-000000000001', 'nuevo_juego', 'sin juego') $$, '23514', null, '"nuevo_juego" exige un juego');
select throws_ok($$ insert into public.posts (author_id, kind, body) values ('a0000000-0000-0000-0000-000000000001', 'otro_tipo', 'x') $$, '23514', null, 'tipo de avance inválido');
select throws_ok($$ insert into public.posts (author_id, kind, body) values ('a0000000-0000-0000-0000-000000000001', 'avance', '   ') $$, '23514', null, 'texto vacío');
select throws_ok($$ insert into public.posts (author_id, kind, body) values ('a0000000-0000-0000-0000-000000000001', 'avance', repeat('x', 2001)) $$, '23514', null, 'más de 2000 caracteres');
select throws_ok($$ insert into public.posts (author_id, kind, body) values ('b0000000-0000-0000-0000-000000000002', 'avance', 'a nombre de bruno') $$, '42501', null, 'ana NO publica a nombre de bruno');
select throws_ok($$ insert into public.posts (author_id, kind, body, like_count) values ('a0000000-0000-0000-0000-000000000001', 'avance', 'x', 99) $$, '42501', null, 'los contadores no se escriben');
select throws_ok($$ insert into public.posts (author_id, kind, body, status) values ('a0000000-0000-0000-0000-000000000001', 'avance', 'x', 'hidden') $$, '42501', null, 'el estado de moderación no se escribe');

select is(tests.dml_count($$ update public.posts set body = 'Día 12: sonidos nuevos' where body = 'Día 12: agregué sonidos' $$), 1::bigint, 'ana edita su avance');
select throws_ok($$ update public.posts set kind = 'hito' where body = 'Salió la v0.1' $$, '42501', null, 'el tipo no cambia después de publicar');
select throws_ok($$ update public.posts set game_id = '11111111-1111-1111-1111-111111111102' where body = 'Salió la v0.1' $$, '42501', null, 'ni el juego vinculado');
select throws_ok($$ update public.posts set like_count = 1000 where body = 'Salió la v0.1' $$, '42501', null, 'ni los contadores');
select throws_ok($$ update public.posts set status = 'removed' where body = 'Salió la v0.1' $$, '42501', null, 'ni el estado');

-- Con otra cuenta: no se edita ni se borra lo ajeno.
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.posts), 4::bigint, 'bruno ve los 4 avances publicados de ana (y no el oculto)');
select is(tests.dml_count($$ update public.posts set body = 'hackeado' $$), 0::bigint, 'bruno NO edita avances ajenos');
select is(tests.dml_count($$ delete from public.posts $$), 0::bigint, 'bruno NO borra avances ajenos');
select lives_ok($$ insert into public.posts (author_id, kind, body) values ('b0000000-0000-0000-0000-000000000002', 'avance', 'Mi avance') $$, 'bruno publica el suyo');

-- Visibilidad de un avance oculto por moderación.
select tests.clear_authentication();
update public.posts set status = 'hidden' where body = 'Salió la v0.1';
select tests.authenticate_as_anon();
select is((select count(*) from public.posts where body = 'Salió la v0.1'), 0::bigint, 'un avance oculto desaparece para el público');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.posts where body = 'Salió la v0.1'), 0::bigint, 'y para el resto de las cuentas');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.posts where body = 'Salió la v0.1'), 1::bigint, 'su autora sí lo ve');
select is(tests.dml_count($$ update public.posts set body = 'intento editar lo moderado' where body = 'Salió la v0.1' $$), 0::bigint, 'pero no puede editarlo mientras esté moderado (0 filas)');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.posts where body = 'Salió la v0.1'), 1::bigint, 'la admin también');
select tests.clear_authentication();
update public.posts set status = 'published' where body = 'Salió la v0.1';

-- =================================================================== ARCHIVOS DE UN AVANCE
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, width, height, alt_text, position) select id, 'image', 'media/a/1.webp', 'image/webp', 120000, 800, 450, 'Captura del nivel 2', 1 from public.posts where body = 'Salió la v0.1' $$, 'ana adjunta una imagen');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) select id, 'video', 'media/a/2.mp4', 'video/mp4', 20971521, 2 from public.posts where body = 'Salió la v0.1' $$, '23514', null, 'más de 20 MB');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) select id, 'image', 'media/a/3.html', 'text/html', 100, 2 from public.posts where body = 'Salió la v0.1' $$, '23514', null, 'tipo de archivo no permitido');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) select id, 'image', 'media/a/5.png', 'image/png', 100, 5 from public.posts where body = 'Salió la v0.1' $$, '23514', null, 'máximo 4 archivos');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ insert into public.post_media (post_id, kind, path, mime, bytes, position) select id, 'image', 'media/b/1.png', 'image/png', 100, 2 from public.posts where body = 'Salió la v0.1' $$, '42501', null, 'bruno NO adjunta archivos al avance de ana');
select is(tests.dml_count($$ delete from public.post_media $$), 0::bigint, 'ni borra los de ana');
select tests.authenticate_as_anon();
select is((select count(*) from public.post_media), 1::bigint, 'el público ve los archivos de un avance publicado');

-- =================================================================== COMENTARIOS
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ insert into public.comments (author_id, post_id, body, label) select 'b0000000-0000-0000-0000-000000000002', id, 'Me encantó la música', 'liked' from public.posts where body = 'Día 12: sonidos nuevos' $$, 'bruno comenta un avance con etiqueta "Me gustó"');
select throws_ok($$ insert into public.comments (author_id, post_id, body) select 'c0000000-0000-0000-0000-000000000003', id, 'a nombre de carla' from public.posts where body = 'Día 12: sonidos nuevos' $$, '42501', null, 'no se comenta a nombre de otra persona');
select throws_ok($$ insert into public.comments (author_id, post_id, body, label) select 'b0000000-0000-0000-0000-000000000002', id, 'x', 'meh' from public.posts where body = 'Día 12: sonidos nuevos' $$, '23514', null, 'etiqueta inválida');
select throws_ok($$ insert into public.comments (author_id, post_id, game_id, body) select 'b0000000-0000-0000-0000-000000000002', p.id, '11111111-1111-1111-1111-111111111101', 'dos destinos' from public.posts p where p.body = 'Día 12: sonidos nuevos' $$, '23514', null, 'un comentario tiene un solo destino');
select throws_ok($$ insert into public.comments (author_id, body) values ('b0000000-0000-0000-0000-000000000002', 'sin destino') $$, '42501', null, 'y al menos uno (la policy lo frena antes)');
select throws_ok($$ insert into public.comments (author_id, post_id, body, is_helpful) select 'b0000000-0000-0000-0000-000000000002', id, 'x', true from public.posts where body = 'Día 12: sonidos nuevos' $$, '42501', null, 'nadie se marca a sí mismo "Me sirvió"');
select throws_ok($$ update public.comments set is_helpful = true where label = 'liked' $$, '42501', null, 'el autor tampoco puede marcar su propio comentario');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ update public.comments set is_helpful = true where label = 'liked' $$, '42501', null, 'ni siquiera la autora del avance por UPDATE directo ("Me sirvió" va por una función)');
select lives_ok($$ insert into public.comments (author_id, post_id, parent_id, body) select 'a0000000-0000-0000-0000-000000000001', c.post_id, c.id, '¡Gracias!' from public.comments c where c.label = 'liked' $$, 'ana responde (un nivel)');
select throws_ok($$ insert into public.comments (author_id, post_id, parent_id, body) select 'a0000000-0000-0000-0000-000000000001', c.post_id, c.id, 'respuesta a la respuesta' from public.comments c where c.body = '¡Gracias!' $$, 'P0001', 'reply_depth_exceeded', 'no hay respuestas de segundo nivel');
select throws_ok($$ insert into public.comments (author_id, post_id, parent_id, body, label) select 'a0000000-0000-0000-0000-000000000001', c.post_id, c.id, 'con etiqueta', 'liked' from public.comments c where c.label = 'liked' $$, 'P0001', 'reply_cannot_have_label', 'las respuestas no llevan etiqueta');
select throws_ok($$ insert into public.comments (author_id, post_id, parent_id, body) select 'a0000000-0000-0000-0000-000000000001', p.id, c.id, 'de otro avance' from public.comments c, public.posts p where c.label = 'liked' and p.body = 'Mi avance' $$, 'P0001', 'parent_target_mismatch', 'la respuesta debe ser del mismo avance');
select is(tests.dml_count($$ update public.comments set body = 'editado por la autora del avance' where label = 'liked' $$), 0::bigint, 'la dueña del avance NO edita comentarios ajenos');
select is(tests.dml_count($$ delete from public.comments where label = 'liked' $$), 0::bigint, 'ni los borra (para eso están los reportes)');
select is((select comment_count from public.posts where body = 'Día 12: sonidos nuevos'), 2, 'el contador del avance cuenta comentario + respuesta');

select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select is(tests.dml_count($$ update public.comments set body = 'hack' $$), 0::bigint, 'carla NO edita comentarios ajenos');
select is(tests.dml_count($$ delete from public.comments $$), 0::bigint, 'ni los borra');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(tests.dml_count($$ update public.comments set body = 'Me encantó la música y el arte', label = 'suggestion' where label = 'liked' $$), 1::bigint, 'bruno edita su comentario');
select tests.authenticate_as_anon();
select is((select count(*) from public.comments), 2::bigint, 'el público lee los comentarios');
select throws_ok($$ insert into public.comments (author_id, post_id, body) select 'a0000000-0000-0000-0000-000000000001', id, 'anónimo' from public.posts limit 1 $$, '42501', null, 'anon no comenta');

-- Comentarios sobre un avance oculto o un juego moderado: no se pueden crear.
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select throws_ok($$ insert into public.comments (author_id, post_id, body) values ('c0000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555501', 'comento algo oculto') $$, '42501', null, 'no se comenta un avance oculto');

-- Contador: si un admin oculta un comentario, baja.
select tests.clear_authentication();
update public.comments set status = 'hidden' where body = '¡Gracias!';
select is((select comment_count from public.posts where body = 'Día 12: sonidos nuevos'), 1, 'ocultar un comentario baja el contador');

-- =================================================================== FEEDBACK EN LA PÁGINA DEL JUEGO
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select lives_ok($$ insert into public.comments (author_id, game_id, body, label) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', 'El nivel 3 es muy difícil', 'suggestion') $$, 'carla deja una sugerencia en el juego');
select lives_ok($$ insert into public.comments (author_id, game_id, question_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '44444444-4444-4444-4444-444444444401', 'Sí, se entiende') $$, 'carla responde una pregunta de feedback');
select throws_ok($$ insert into public.comments (author_id, game_id, question_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101', '44444444-4444-4444-4444-444444444401', 'Otra respuesta') $$, '23505', null, 'una respuesta por persona y pregunta');
select throws_ok($$ insert into public.comments (author_id, game_id, question_id, body) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111102', '44444444-4444-4444-4444-444444444401', 'Pregunta de otro juego') $$, 'P0001', 'question_mismatch', 'la pregunta debe ser de ese juego');
select throws_ok($$ insert into public.comments (author_id, post_id, question_id, body) select 'c0000000-0000-0000-0000-000000000003', id, '44444444-4444-4444-4444-444444444401', 'pregunta en un avance' from public.posts limit 1 $$, 'P0001', 'question_mismatch', 'las preguntas son de juegos, no de avances');
select is((select comment_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 2, 'contador de comentarios del juego');

-- =================================================================== ME GUSTA Y GUARDADOS
select lives_ok($$ insert into public.post_likes (user_id, post_id) select 'c0000000-0000-0000-0000-000000000003', id from public.posts where body = 'Día 12: sonidos nuevos' $$, 'carla da me gusta a un avance');
select throws_ok($$ insert into public.post_likes (user_id, post_id) select 'c0000000-0000-0000-0000-000000000003', id from public.posts where body = 'Día 12: sonidos nuevos' $$, '23505', null, 'un solo me gusta por persona');
select throws_ok($$ insert into public.post_likes (user_id, post_id) select 'b0000000-0000-0000-0000-000000000002', id from public.posts where body = 'Mi avance' $$, '42501', null, 'carla NO da me gusta en nombre de bruno');
select is((select like_count from public.posts where body = 'Día 12: sonidos nuevos'), 1, 'contador de me gusta = 1');
select lives_ok($$ insert into public.game_likes (user_id, game_id) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101') $$, 'me gusta a un juego');
select lives_ok($$ insert into public.post_saves (user_id, post_id) select 'c0000000-0000-0000-0000-000000000003', id from public.posts where body = 'Mi avance' $$, 'guarda un avance');
select lives_ok($$ insert into public.game_saves (user_id, game_id) values ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111101') $$, 'guarda un juego');
select is((select save_count from public.games where id = '11111111-1111-1111-1111-111111111101'), 1, 'contador de guardados del juego');
select is((select count(*) from public.post_likes) + (select count(*) from public.game_likes) + (select count(*) from public.post_saves) + (select count(*) from public.game_saves), 4::bigint, 'carla ve sus 4 marcas');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.post_likes) + (select count(*) from public.game_likes) + (select count(*) from public.post_saves) + (select count(*) from public.game_saves), 0::bigint, 'bruno NO ve los me gusta ni los guardados de carla (son privados)');
select is(tests.dml_count($$ delete from public.post_likes $$), 0::bigint, 'ni los borra');
select is(tests.dml_count($$ delete from public.game_saves $$), 0::bigint, 'ni borra sus guardados');
select tests.authenticate_as_anon();
select throws_ok($$ select * from public.post_likes $$, '42501', null, 'anon no lee me gusta');
select throws_ok($$ insert into public.game_likes (user_id, game_id) values (gen_random_uuid(), '11111111-1111-1111-1111-111111111101') $$, '42501', null, 'anon no da me gusta');

select throws_ok($$ insert into public.post_likes (user_id, post_id) values ('c0000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555501') $$, '42501', null, 'no se da me gusta a un avance oculto');
select throws_ok($$ insert into public.post_saves (user_id, post_id) values ('c0000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555501') $$, '42501', null, 'ni se guarda');

select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select is(tests.dml_count($$ delete from public.post_likes $$), 1::bigint, 'carla quita su me gusta');
select is((select like_count from public.posts where body = 'Día 12: sonidos nuevos'), 0, 'el contador vuelve a 0');

-- =================================================================== CUENTA SUSPENDIDA
select tests.clear_authentication();
update public.profile_private set status = 'suspended' where id = 'b0000000-0000-0000-0000-000000000002';
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ insert into public.posts (author_id, kind, body) values ('b0000000-0000-0000-0000-000000000002', 'avance', 'sigo publicando') $$, '42501', null, 'una cuenta suspendida no publica');
select throws_ok($$ insert into public.comments (author_id, game_id, body) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101', 'sigo comentando') $$, '42501', null, 'ni comenta');
select throws_ok($$ insert into public.game_likes (user_id, game_id) values ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111101') $$, '42501', null, 'ni da me gusta');
select is(tests.dml_count($$ delete from public.posts where body = 'Mi avance' $$), 0::bigint, 'ni borra evidencia');

-- =================================================================== CASCADA
select tests.clear_authentication();
delete from auth.users where id = 'a0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.posts where author_id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'al borrar una cuenta se borran sus avances');
select is((select count(*) from public.comments where game_id = '11111111-1111-1111-1111-111111111101'), 0::bigint, 'y los comentarios de sus juegos');
select is((select count(*) from public.game_likes), 0::bigint, 'y los me gusta de sus juegos');

select * from finish();
rollback;
