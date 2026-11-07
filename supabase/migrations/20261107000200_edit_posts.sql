-- ---------------------------------------------------------------------------------------------
-- Editing an update: everything about it can change, in one transaction.
--
-- The author can change the kind, the linked game, the text, the highlight and the files (add, remove, reorder, describe).
-- edit_post(...) does it all or nothing: it updates the post and replaces its file list in one go, so a failure in the middle
-- can never leave an update with half of its files. It is SECURITY INVOKER on purpose: every statement runs as the caller, so
-- row-level security and the column grants decide who may edit (only the author, only a published update, only an account
-- that can write), and the table constraints keep checking the shape of every row (a launch needs its game, a file's path must
-- be inside this post's folder, kind/type/extension/size must agree). The game of a post must still be the author's own
-- (posts_before_write). Counters, status and the author stay out of reach: they have no column grant.
-- ---------------------------------------------------------------------------------------------

grant update (kind, game_id) on public.posts to authenticated;

create function public.edit_post(
  p_post_id uuid,
  p_kind text,
  p_body text,
  p_game_id uuid,
  p_highlight text,
  p_media jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_media) is distinct from 'array' then
    raise exception 'invalid_media';
  end if;

  update public.posts p
     set kind = p_kind,
         body = p_body,
         game_id = p_game_id,
         highlight = case when p_kind = 'hito' then nullif(btrim(p_highlight), '') else null end
   where p.id = p_post_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'post_not_found';
  end if;

  delete from public.post_media m where m.post_id = p_post_id;

  insert into public.post_media (post_id, kind, path, mime, bytes, width, height, alt_text, position)
  select p_post_id,
         e.value ->> 'kind',
         e.value ->> 'path',
         e.value ->> 'mime',
         (e.value ->> 'bytes')::integer,
         (e.value ->> 'width')::smallint,
         (e.value ->> 'height')::smallint,
         coalesce(e.value ->> 'alt_text', ''),
         e.ord::smallint
  from jsonb_array_elements(p_media) with ordinality as e(value, ord);
end;
$$;

revoke all on function public.edit_post(uuid, text, text, uuid, text, jsonb) from public;
grant execute on function public.edit_post(uuid, text, text, uuid, text, jsonb) to authenticated;
