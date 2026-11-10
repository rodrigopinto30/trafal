-- Marking a comment as helpful, unmarking it and marking it again must not tell its author over and over: one notice per comment.
create unique index notifications_helpful_once
  on public.notifications (user_id, comment_id)
  where type = 'helpful';

create or replace function private.notify_helpful() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.is_helpful and not old.is_helpful and new.status = 'published' then
    if new.game_id is not null then
      select g.owner_id into v_owner from public.games g where g.id = new.game_id;
    else
      select p.author_id into v_owner from public.posts p where p.id = new.post_id;
    end if;
    if v_owner is not null and v_owner <> new.author_id then
      insert into public.notifications (user_id, type, actor_id, game_id, post_id, comment_id)
      values (new.author_id, 'helpful', v_owner, new.game_id, new.post_id, new.id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
