-- ---------------------------------------------------------------------------------------------
-- Comment rules, tightened now that people can write, edit and answer comments from the interface.
--
--   * A comment can only be edited while it is published: once moderation hides or removes it, its author can no longer
--     change what it says (they could before, because the update policy never looked at the status).
--   * A reply can only answer a published comment: answering one that moderation hid would resurrect the conversation.
-- Everything else (one level of replies, same target, no label or question on a reply, own rows only) already held.
-- ---------------------------------------------------------------------------------------------

drop policy comments_update on public.comments;
create policy comments_update on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and status = 'published' and private.can_write())
  with check (author_id = (select auth.uid()) and status = 'published' and private.can_write());

create or replace function private.comments_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.comments;
begin
  new.body := btrim(new.body);

  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    if not found or v_parent.status <> 'published' then
      raise exception 'parent_not_found';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'reply_depth_exceeded';
    end if;
    if v_parent.post_id is distinct from new.post_id or v_parent.game_id is distinct from new.game_id then
      raise exception 'parent_target_mismatch';
    end if;
    if new.label is not null then
      raise exception 'reply_cannot_have_label';
    end if;
    if new.question_id is not null then
      raise exception 'reply_cannot_answer_question';
    end if;
  end if;

  if new.question_id is not null
     and not exists (select 1 from public.game_questions q where q.id = new.question_id and q.game_id = new.game_id) then
    raise exception 'question_mismatch';
  end if;

  return new;
end;
$$;
