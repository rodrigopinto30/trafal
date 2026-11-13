-- ---------------------------------------------------------------------------------------------
-- Editing a game after it was uploaded: details, cover, screenshots and questions, in one transaction.
--
-- The owner can change the title, short description, genre, tags, controls, cover, screenshots and the feedback questions of a
-- draft or published game. edit_game(...) does it all or nothing, so a failure in the middle can never leave a game with a new
-- title and half of its screenshots. It is SECURITY INVOKER on purpose, like edit_post: every statement runs as the caller, so
-- row-level security and the column grants decide who may edit (only the owner, only an account that can write), and the table
-- constraints keep checking the shape of every row (a cover or screenshot path must live inside the owner's or the game's own
-- folder). A game that moderation hid or removed cannot be edited: it would let someone rewrite what was reported. The owner,
-- the public id, the status, the active version and the counters stay out of reach (no column grant).
--
-- Questions are matched by position: an existing question keeps its id when its text changes, so the answers people already
-- wrote stay attached to it; a question that disappears from the end of the list is deleted and its answers become plain
-- comments (comments.question_id is set null).
-- ---------------------------------------------------------------------------------------------

create function public.edit_game(
  p_game_id uuid,
  p_title text,
  p_short_description text,
  p_genre_id text,
  p_tags text[],
  p_controls text,
  p_cover_path text,
  p_screenshots jsonb,
  p_questions text[]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
  v_questions text[] := coalesce(p_questions, '{}');
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_screenshots) is distinct from 'array' then
    raise exception 'invalid_screenshots';
  end if;
  if cardinality(v_questions) > 3 then
    raise exception 'too_many_questions';
  end if;

  update public.games g
     set title = p_title,
         short_description = p_short_description,
         genre_id = p_genre_id,
         tags = coalesce(p_tags, '{}'),
         controls = p_controls,
         cover_path = p_cover_path
   where g.id = p_game_id
     and g.status in ('draft', 'published');
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'game_not_found';
  end if;

  delete from public.game_screenshots s where s.game_id = p_game_id;

  insert into public.game_screenshots (game_id, path, alt_text, position)
  select p_game_id,
         e.value ->> 'path',
         coalesce(e.value ->> 'alt_text', ''),
         e.ord::smallint
  from jsonb_array_elements(p_screenshots) with ordinality as e(value, ord);

  insert into public.game_questions (game_id, position, question)
  select p_game_id, q.ord::smallint, q.question
  from unnest(v_questions) with ordinality as q(question, ord)
  on conflict (game_id, position) do update set question = excluded.question;

  delete from public.game_questions q where q.game_id = p_game_id and q.position > cardinality(v_questions);
end;
$$;

revoke all on function public.edit_game(uuid, text, text, text, text[], text, text, jsonb, text[]) from public;
grant execute on function public.edit_game(uuid, text, text, text, text[], text, text, jsonb, text[]) to authenticated;
