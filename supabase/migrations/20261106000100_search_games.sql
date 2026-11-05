-- ---------------------------------------------------------------------------------------------
-- Buscador de juegos.
--
-- search_games(texto) devuelve los juegos PUBLICADOS que coinciden, del más al menos relevante. Usa el índice de
-- búsqueda que ya tiene `games` (search_doc: título pesa más que descripción y etiquetas, y esas más que género,
-- motor y creador) y no depende de tildes ni de mayúsculas.
--
-- Cada palabra se busca como prefijo («orb» encuentra «Órbita»), así sirve para las sugerencias mientras se escribe.
-- Del texto solo se conservan letras y números, y la consulta se arma con esas palabras ya limpias: nada de lo que
-- escriba la persona llega como operador de tsquery.
--
-- SECURITY INVOKER a propósito: corre con los permisos de quien llama, o sea que la RLS de `games` sigue mandando.
-- Se filtra `published` aparte porque esa política también deja ver los borradores propios.
-- ---------------------------------------------------------------------------------------------

create function public.search_games(p_query text, p_limit integer default 24)
returns table (id uuid, rank real)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    select w
    from unnest(
      regexp_split_to_array(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, left(coalesce(p_query, ''), 80))),
        '[^[:alnum:]]+'
      )
    ) as w
    where w <> ''
    limit 8
  ),
  q as (
    select to_tsquery('simple', string_agg(w || ':*', ' & ')) as query
    from words
    having count(*) > 0
  )
  select g.id, ts_rank(g.search_doc, q.query) as rank
  from public.games g
  cross join q
  where g.status = 'published'
    and g.search_doc @@ q.query
  order by rank desc, g.play_count desc, g.published_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 50);
$$;

revoke all on function public.search_games(text, integer) from public;
grant execute on function public.search_games(text, integer) to anon, authenticated;
