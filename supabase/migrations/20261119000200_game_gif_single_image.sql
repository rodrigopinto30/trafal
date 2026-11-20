-- ---------------------------------------------------------------------------------------------
-- A game has at most one image, its cover, and optionally a GIF; screenshots are gone.
--
-- Storage is scarce, so a game keeps a single picture. The GIF is optional and, when there is one, it is what the site shows in
-- place of the cover. It lives in the owner's covers folder, like the cover, so deleting the account deletes it too
-- (private.account_files already lists covers/<owner>/). The path is checked by the database like the cover's.
--
-- edit_game(...) is replaced by a version that takes the GIF and no screenshots; the screenshots table is dropped (nothing in the
-- product shows them, and no game has any).
-- ---------------------------------------------------------------------------------------------

alter table public.games
  add column gif_path text,
  add constraint games_gif_len check (gif_path is null or char_length(gif_path) <= 300),
  add constraint games_gif_path_fmt check (gif_path is null or gif_path ~ ('^covers/' || owner_id::text || '/[0-9a-f]{32}\.gif$'));

grant insert (gif_path), update (gif_path) on public.games to authenticated;

drop function public.edit_game(uuid, text, text, text, text[], text, text, jsonb, text[]);
drop table public.game_screenshots;

-- Editing a game after it was uploaded: details, cover, GIF and questions, in one transaction. SECURITY INVOKER on purpose, like
-- edit_post: row-level security and the column grants decide who may edit, and the table constraints check every path. A game
-- that moderation hid or removed cannot be edited. Questions are matched by position, so the answers people already wrote stay
-- attached to a question whose text changes.
create function public.edit_game(
  p_game_id uuid,
  p_title text,
  p_short_description text,
  p_genre_id text,
  p_tags text[],
  p_controls text,
  p_cover_path text,
  p_gif_path text,
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
  if cardinality(v_questions) > 3 then
    raise exception 'too_many_questions';
  end if;

  update public.games g
     set title = p_title,
         short_description = p_short_description,
         genre_id = p_genre_id,
         tags = coalesce(p_tags, '{}'),
         controls = p_controls,
         cover_path = p_cover_path,
         gif_path = p_gif_path
   where g.id = p_game_id
     and g.status in ('draft', 'published');
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'game_not_found';
  end if;

  insert into public.game_questions (game_id, position, question)
  select p_game_id, q.ord::smallint, q.question
  from unnest(v_questions) with ordinality as q(question, ord)
  on conflict (game_id, position) do update set question = excluded.question;

  delete from public.game_questions q where q.game_id = p_game_id and q.position > cardinality(v_questions);
end;
$$;

revoke all on function public.edit_game(uuid, text, text, text, text[], text, text, text, text[]) from public;
grant execute on function public.edit_game(uuid, text, text, text, text[], text, text, text, text[]) to authenticated;
