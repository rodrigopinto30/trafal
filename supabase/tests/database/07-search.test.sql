-- Buscador de juegos: search_games(texto).
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

create function pg_temp.make_game(p_owner uuid, p_title text, p_description text, p_tags text[], p_status text, p_plays integer default 0)
returns void language plpgsql as $$
declare
  v_game uuid;
  v_version uuid;
begin
  insert into public.games (owner_id, title, short_description, genre_id, engine_id, tags)
    values (p_owner, p_title, p_description, 'platformer', 'godot', p_tags)
    returning id into v_game;
  insert into public.game_versions (game_id, number, label, status) values (v_game, 1, 'v1', 'ready') returning id into v_version;
  if p_status = 'published' then
    update public.games set active_version_id = v_version, status = 'published', play_count = p_plays
      where id = v_game;
  end if;
end;
$$;

select pg_temp.make_game('a0000000-0000-0000-0000-000000000001', 'Órbita Roja', 'Naves y asteroides', array['espacio'], 'published');
select pg_temp.make_game('a0000000-0000-0000-0000-000000000001', 'Sonidos del Espacio', 'Una órbita tranquila para escuchar', array['relax'], 'published', 5);
select pg_temp.make_game('a0000000-0000-0000-0000-000000000001', 'Gato Láser', 'Perseguí el punto rojo', array['gatos'], 'published', 10);
select pg_temp.make_game('b0000000-0000-0000-0000-000000000002', 'Órbita Secreta', 'Todavía en borrador', array['espacio'], 'draft');

create function pg_temp.titles(p_query text) returns text
language sql as $$
  select coalesce(string_agg(g.title, ' | ' order by s.rank desc, g.play_count desc, g.published_at desc), '')
    from public.search_games(p_query) s join public.games g on g.id = s.id
$$;

-- ------------------------------------------------------------------ visitante (sin sesión)
select tests.authenticate_as_anon();
select is(pg_temp.titles('orbita'), 'Órbita Roja | Sonidos del Espacio', 'ignora tildes y pone primero al que lo tiene en el título');
select is(pg_temp.titles('ÓRBITA'), 'Órbita Roja | Sonidos del Espacio', 'ignora mayúsculas y tildes en lo que se escribe');
select is(pg_temp.titles('orb'), 'Órbita Roja | Sonidos del Espacio', 'cada palabra se busca como prefijo (sugerencias mientras se escribe)');
select is(pg_temp.titles('gato laser'), 'Gato Láser', 'varias palabras: tienen que estar todas');
select is(pg_temp.titles('  gato   ...  láser  '), 'Gato Láser', 'los espacios y signos sobrantes no importan');
select is(pg_temp.titles('gatos'), 'Gato Láser', 'busca en las etiquetas');
select is(pg_temp.titles('asteroides'), 'Órbita Roja', 'busca en la descripción');
select is(pg_temp.titles('espacio'), 'Sonidos del Espacio | Órbita Roja', 'lo que está en el título pesa más que lo que está en una etiqueta');
select is(pg_temp.titles('ana'), 'Gato Láser | Sonidos del Espacio | Órbita Roja', 'busca por creador; a igual relevancia, el más jugado primero');
select is(pg_temp.titles('godot'), 'Gato Láser | Sonidos del Espacio | Órbita Roja', 'busca por motor');
select is(pg_temp.titles('secreta'), '', 'los borradores no aparecen en la búsqueda pública');
select is(pg_temp.titles('orbita laser'), '', 'si falta una palabra, no hay resultado');
select is(pg_temp.titles('zzzz'), '', 'sin coincidencias');

-- ------------------------------------------------------------------ entradas raras
select is(pg_temp.titles(''), '', 'texto vacío: sin resultados');
select is(pg_temp.titles('   '), '', 'solo espacios: sin resultados');
select is(pg_temp.titles(null), '', 'null: sin resultados');
select is(pg_temp.titles('!!! ... ---'), '', 'solo signos: sin resultados');
select lives_ok($$ select * from public.search_games('''); drop table public.games; -- & | ! : * ( ) <-> \') $$, 'caracteres de la sintaxis de búsqueda no la rompen ni se ejecutan');
select lives_ok($$ select * from public.search_games(repeat('a', 5000)) $$, 'un texto larguísimo se recorta');
select lives_ok($$ select * from public.search_games('a b c d e f g h i j k l m n') $$, 'muchas palabras: se usan las primeras');
select is((select count(*) from public.search_games('a', 1)), 1::bigint, 'el límite se respeta');
select is((select count(*) from public.search_games('ana', -5)), 1::bigint, 'un límite negativo se lleva a 1');
select is((select count(*) from public.search_games('ana', 9999)), 3::bigint, 'y uno enorme, al máximo permitido');
select is((select count(*) from public.games where status = 'published'), 3::bigint, 'la búsqueda no alteró los datos');

-- ------------------------------------------------------------------ quien tiene borradores propios
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(pg_temp.titles('secreta'), '', 'ni su propio dueño ve sus borradores en la búsqueda pública');
select is((select count(*) from public.games where title = 'Órbita Secreta'), 1::bigint, 'aunque en su perfil sí los ve');

select * from finish();
rollback;
