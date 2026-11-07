-- ---------------------------------------------------------------------------------------------
-- «Me sirvió»: the creator of a game (or the author of an update) marks the comments that helped them.
--
-- comments.is_helpful has no column grant, on purpose: nobody can mark their own comment, and nobody but the owner of the
-- game or the update the comment is on can mark it. set_comment_helpful(comment, helpful) is the only way, and it checks
-- all of that. Only published, top-level comments from other people can be marked (a reply is a conversation, not feedback).
--
-- Marking a comment is not editing it: updated_at only moves when its text or label change, so the «edited» tag of a comment
-- never shows up because the creator found it useful.
-- ---------------------------------------------------------------------------------------------

drop trigger comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at
  before update of body, label on public.comments
  for each row execute function private.touch_updated_at();

create function public.set_comment_helpful(p_comment_id uuid, p_helpful boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_comment public.comments;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.can_write() then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  select * into v_comment from public.comments c where c.id = p_comment_id and c.status = 'published';
  if not found then
    raise exception 'comment_not_found';
  end if;

  if v_comment.game_id is not null then
    select g.owner_id into v_owner from public.games g where g.id = v_comment.game_id and g.status = 'published';
  else
    select p.author_id into v_owner from public.posts p where p.id = v_comment.post_id and p.status = 'published';
  end if;
  if v_owner is null then
    raise exception 'comment_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if v_comment.author_id = v_uid then
    raise exception 'own_comment';
  end if;
  if v_comment.parent_id is not null then
    raise exception 'reply_cannot_be_helpful';
  end if;

  update public.comments c set is_helpful = coalesce(p_helpful, false) where c.id = p_comment_id;
end;
$$;

revoke all on function public.set_comment_helpful(uuid, boolean) from public;
grant execute on function public.set_comment_helpful(uuid, boolean) to authenticated;
