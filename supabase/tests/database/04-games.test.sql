-- Juegos, capturas, preguntas de feedback y versiones.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

-- ------------------------------------------------------------------ crear (ana)
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.games (owner_id, title, short_description, genre_id, tags)
                   values ('a0000000-0000-0000-0000-000000000001', '  Luciérnaga Valiente ', 'Plataformas corto en una cueva', 'platformer', array['  Retro ', 'RETRO', 'pixel', '']) $$,
                'ana crea un juego');
select is((select status from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), 'draft', 'nace como borrador');
select is((select title from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), 'Luciérnaga Valiente', 'el título se guarda sin espacios sobrantes');
select is((select tags from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), array['pixel', 'retro'], 'etiquetas en minúsculas, sin duplicados ni vacías');
select matches((select public_id from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), '^[a-hj-km-np-z2-9]{12}$', 'public_id: 12 caracteres aptos para subdominio');
select ok((select search_doc @@ to_tsquery('simple', 'luciernaga') from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), 'el buscador ignora tildes');
select ok((select search_doc @@ to_tsquery('simple', 'plataformas') from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), 'busca por género (en español)');
select ok((select search_doc @@ to_tsquery('simple', 'platformer') from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), 'busca por género (en inglés)');
select ok((select search_doc @@ to_tsquery('simple', 'ana') from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), 'busca por creador');

select throws_ok($$ insert into public.games (owner_id, title) values ('b0000000-0000-0000-0000-000000000002', 'A nombre de bruno') $$, '42501', null, 'ana NO crea juegos a nombre de otra persona');
select throws_ok($$ insert into public.games (owner_id, title, status) values ('a0000000-0000-0000-0000-000000000001', 'Nacido publicado', 'published') $$, '42501', null, 'no se puede nacer publicado');
select throws_ok($$ insert into public.games (owner_id, title, like_count) values ('a0000000-0000-0000-0000-000000000001', 'Con likes', 500) $$, '42501', null, 'los contadores no se escriben');
select throws_ok($$ insert into public.games (owner_id, title, public_id) values ('a0000000-0000-0000-0000-000000000001', 'Con id elegido', 'admin') $$, '42501', null, 'el subdominio (public_id) no se elige');
select throws_ok($$ insert into public.games (owner_id, title, tags) values ('a0000000-0000-0000-0000-000000000001', 'Muchas tags', array['a1','a2','a3','a4','a5','a6','a7','a8','a9']) $$, 'P0001', 'too_many_tags', 'máximo 8 etiquetas');
select throws_ok($$ insert into public.games (owner_id, title, external_url) values ('a0000000-0000-0000-0000-000000000001', 'Link malo', 'javascript:alert(1)') $$, '23514', null, 'el link externo solo admite http(s)');
select lives_ok($$ insert into public.games (owner_id, title, external_url) values ('a0000000-0000-0000-0000-000000000001', 'Link bueno', 'https://miusuario.itch.io/juego') $$, 'link externo válido');
select throws_ok($$ insert into public.games (owner_id, title, genre_id) values ('a0000000-0000-0000-0000-000000000001', 'Género falso', 'inexistente') $$, '23503', null, 'el género debe existir');
select throws_ok($$ insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', '') $$, '23514', null, 'título vacío');

-- "¿Es tu primer juego?": uno solo por persona.
select lives_ok($$ update public.games set is_first_game = true where title = 'Luciérnaga Valiente' $$, 'marca su primer juego');
select throws_ok($$ update public.games set is_first_game = true where title = 'Link bueno' $$, '23505', null, 'solo un juego puede ser "el primero"');

-- ------------------------------------------------------------------ visibilidad de borradores
select tests.authenticate_as_anon();
select is((select count(*) from public.games), 0::bigint, 'los visitantes no ven borradores');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.games), 0::bigint, 'bruno no ve los borradores de ana');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is((select count(*) from public.games), 2::bigint, 'la admin sí ve los borradores');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.games), 2::bigint, 'ana ve los suyos');

-- ------------------------------------------------------------------ publicar
select throws_ok($$ update public.games set status = 'published' where title = 'Luciérnaga Valiente' $$, 'P0001', 'publish_requires_ready_version', 'no se publica sin una versión lista');

-- Preparo, como el sistema, una versión subiendo y otra lista.
select tests.clear_authentication();
insert into public.game_versions (id, game_id, number, label, status)
  select '22222222-2222-2222-2222-222222222221', id, 1, 'v0.1', 'ready' from public.games where title = 'Luciérnaga Valiente';
insert into public.game_versions (id, game_id, number, label, status)
  select '22222222-2222-2222-2222-222222222222', id, 2, 'v0.2', 'uploading' from public.games where title = 'Luciérnaga Valiente';
insert into public.game_versions (id, game_id, number, label, status)
  select '22222222-2222-2222-2222-222222222223', id, 1, 'v0.1', 'ready' from public.games where title = 'Link bueno';

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ update public.games set active_version_id = '22222222-2222-2222-2222-222222222221' where title = 'Luciérnaga Valiente' $$, '42501', null, 'la versión activa no se elige por UPDATE directo (hay una función)');

select tests.clear_authentication();
select throws_ok($$ update public.games set active_version_id = '22222222-2222-2222-2222-222222222222' where title = 'Luciérnaga Valiente' $$, 'P0001', 'version_not_ready', 'una versión que sigue subiendo no puede ser la activa');
select throws_ok($$ update public.games set active_version_id = '22222222-2222-2222-2222-222222222223' where title = 'Luciérnaga Valiente' $$, 'P0001', 'version_not_found', 'la versión activa debe ser de ese mismo juego');
update public.games set active_version_id = '22222222-2222-2222-2222-222222222221' where title = 'Luciérnaga Valiente';

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(tests.dml_count($$ update public.games set status = 'published' where title = 'Luciérnaga Valiente' $$), 0::bigint, 'bruno NO publica el juego de ana');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ update public.games set status = 'published' where title = 'Luciérnaga Valiente' $$, 'ana publica su juego (ya tiene versión lista)');
select isnt((select published_at from public.games where title = 'Luciérnaga Valiente'), null, 'queda la fecha de publicación');
select throws_ok($$ update public.games set status = 'hidden' where title = 'Luciérnaga Valiente' $$, 'P0001', 'status_change_not_allowed', 'ana no puede "ocultar" (moderación)');
select throws_ok($$ update public.games set status = 'removed' where title = 'Luciérnaga Valiente' $$, 'P0001', 'status_change_not_allowed', 'ni "dar de baja"');
select lives_ok($$ update public.games set status = 'draft' where title = 'Luciérnaga Valiente' $$, 'sí puede volver a borrador');
select lives_ok($$ update public.games set status = 'published' where title = 'Luciérnaga Valiente' $$, 'y republicar');

-- ------------------------------------------------------------------ juego publicado: qué ve cada quien
select tests.authenticate_as_anon();
select is((select count(*) from public.games), 1::bigint, 'los visitantes ven el juego publicado (y solo ese)');
select is((select count(*) from public.game_versions), 1::bigint, 'ven solo versiones listas de juegos publicados (no la que sigue subiendo)');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.game_versions), 3::bigint, 'el dueño ve todas sus versiones (listas y subiendo)');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select count(*) from public.game_versions where status = 'uploading'), 0::bigint, 'bruno no ve las versiones en proceso de ana');

-- ------------------------------------------------------------------ permisos sobre el juego ajeno
select is(tests.dml_count($$ update public.games set title = 'Hackeado' where title = 'Luciérnaga Valiente' $$), 0::bigint, 'bruno NO edita el juego de ana');
select is(tests.dml_count($$ delete from public.games where title = 'Luciérnaga Valiente' $$), 0::bigint, 'bruno NO borra el juego de ana');
select throws_ok($$ update public.games set owner_id = 'b0000000-0000-0000-0000-000000000002' where title = 'Luciérnaga Valiente' $$, '42501', null, 'no se puede robar un juego cambiando owner_id');

-- ------------------------------------------------------------------ versiones: el estado no es del cliente
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.game_versions (game_id, number, label) select id, 9, 'v9' from public.games where title = 'Luciérnaga Valiente' $$, '42501', null, 'las versiones no se crean por INSERT directo (hay una función con cupo diario)');
select throws_ok($$ update public.game_versions set status = 'ready' where label = 'v0.2' $$, '42501', null, 'el dueño NO marca su versión como lista (lo hace el worker)');
select throws_ok($$ update public.game_versions set needs_isolation = true where label = 'v0.2' $$, '42501', null, 'ni toca los campos que calcula el worker');
select throws_ok($$ delete from public.game_versions where label = 'v0.2' $$, '42501', null, 'las versiones no se borran por tabla');
select is(tests.dml_count($$ update public.game_versions set label = 'v0.2-beta', changelog = 'Arreglé el salto' where label = 'v0.2' $$), 1::bigint, 'sí edita etiqueta y changelog');
select throws_ok($$ update public.game_versions set label = '' where label = 'v0.2-beta' $$, '23514', null, 'etiqueta vacía');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(tests.dml_count($$ update public.game_versions set label = 'hack' where changelog = 'Arreglé el salto' $$), 0::bigint, 'bruno NO edita versiones de ana (ni las ve)');

-- ------------------------------------------------------------------ moderación: un juego dado de baja no vuelve solo
select tests.clear_authentication();
update public.games set status = 'hidden' where title = 'Luciérnaga Valiente';
select tests.authenticate_as_anon();
select is((select count(*) from public.games), 0::bigint, 'un juego oculto desaparece para el público');
select is((select count(*) from public.game_versions), 0::bigint, 'y sus versiones también');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.games where title = 'Luciérnaga Valiente'), 1::bigint, 'el dueño sigue viéndolo (para saber qué pasó)');
select throws_ok($$ update public.games set status = 'published' where title = 'Luciérnaga Valiente' $$, 'P0001', 'status_change_not_allowed', 'el dueño no puede volver a publicar un juego moderado');
select is(tests.dml_count($$ delete from public.games where title = 'Luciérnaga Valiente' $$), 0::bigint, 'ni borrarlo para evadir el reclamo');

-- ------------------------------------------------------------------ capturas y preguntas de feedback
select tests.clear_authentication();
update public.games set status = 'published' where title = 'Luciérnaga Valiente';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.game_screenshots (game_id, path, alt_text, position) select id, 'screenshots/' || id || '/0123456789abcdef0123456789abcdef.webp', 'Una luciérnaga en la cueva', 1 from public.games where title = 'Luciérnaga Valiente' $$, 'ana agrega una captura');
select throws_ok($$ insert into public.game_screenshots (game_id, path, position) select id, 'screenshots/' || id || '/0123456789abcdef0123456789abcdef.webp', 7 from public.games where title = 'Luciérnaga Valiente' $$, '23514', null, 'máximo 6 capturas');
select lives_ok($$ insert into public.game_questions (game_id, position, question) select id, 1, '¿El salto se siente bien?' from public.games where title = 'Luciérnaga Valiente' $$, 'ana agrega una pregunta de feedback');
select throws_ok($$ insert into public.game_questions (game_id, position, question) select id, 4, '¿Cuarta pregunta?' from public.games where title = 'Luciérnaga Valiente' $$, '23514', null, 'máximo 3 preguntas');
select throws_ok($$ insert into public.game_questions (game_id, position, question) select id, 1, 'Repetida en la posición 1' from public.games where title = 'Luciérnaga Valiente' $$, '23505', null, 'una pregunta por posición');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$ insert into public.game_screenshots (game_id, path, position) select id, 'media/b/1.webp', 2 from public.games where title = 'Luciérnaga Valiente' $$, '42501', null, 'bruno NO agrega capturas al juego de ana');
select throws_ok($$ insert into public.game_questions (game_id, position, question) select id, 2, 'Pregunta intrusa' from public.games where title = 'Luciérnaga Valiente' $$, '42501', null, 'ni preguntas');
select is(tests.dml_count($$ delete from public.game_screenshots $$), 0::bigint, 'ni borra capturas ajenas');
select is(tests.dml_count($$ update public.game_questions set question = 'Pregunta cambiada por bruno' $$), 0::bigint, 'ni edita preguntas ajenas');
select tests.authenticate_as_anon();
select is((select count(*) from public.game_screenshots), 1::bigint, 'el público ve las capturas de un juego publicado');
select is((select count(*) from public.game_questions), 1::bigint, 'y sus preguntas');

-- ------------------------------------------------------------------ al editarse el nombre, se reindexa el buscador
select tests.clear_authentication();
update public.profiles set display_name = 'Anastasia Pixel' where username = 'ana';
select ok((select search_doc @@ to_tsquery('simple', 'anastasia') from public.games where title = 'Luciérnaga Valiente'), 'si cambia el nombre de la creadora, sus juegos se reindexan');

-- ------------------------------------------------------------------ borrar la cuenta se lleva todo
delete from auth.users where id = 'a0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.games where owner_id = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'al borrar la cuenta se borran sus juegos');
select is((select count(*) from public.game_versions), 0::bigint, 'y sus versiones');

select * from finish();
rollback;
