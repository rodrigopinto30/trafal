-- ---------------------------------------------------------------------------------------------
-- Notifications: what the bell tells each person.
--
-- They are created by triggers (never by the client: there is no INSERT grant), inside the same transaction as the event, so
-- a notification exists if and only if the event happened. Nobody is notified of their own actions.
--
--   comment        someone commented on your game or update (also on a thread of it that is not yours)
--   reply          someone replied to your comment
--   like           someone liked your game or update          (once per person and thing)
--   follow         someone followed you                       (once per person)
--   helpful        the creator marked your comment as helpful
--   version_ready  the version you uploaded passed every check and is ready
--   version_error  the version you uploaded was rejected
--   moderation     an admin hid or restored your content, or suspended or reinstated your account (see 20261109 and 20261110)
--
-- Each person reads, marks as read and dismisses their own (policies of the foundation); the table is already in the realtime
-- publication, so the bell updates while the page is open.
-- ---------------------------------------------------------------------------------------------

create unique index notifications_like_once
  on public.notifications (user_id, actor_id, (coalesce(game_id, post_id)))
  where type = 'like';
create unique index notifications_follow_once
  on public.notifications (user_id, actor_id)
  where type = 'follow';

create function private.notify_comment() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_parent_author uuid;
begin
  if new.status <> 'published' then
    return new;
  end if;

  if new.game_id is not null then
    select g.owner_id into v_owner from public.games g where g.id = new.game_id;
  else
    select p.author_id into v_owner from public.posts p where p.id = new.post_id;
  end if;

  if new.parent_id is not null then
    select c.author_id into v_parent_author from public.comments c where c.id = new.parent_id;
    if v_parent_author is not null and v_parent_author <> new.author_id then
      insert into public.notifications (user_id, type, actor_id, game_id, post_id, comment_id)
      values (v_parent_author, 'reply', new.author_id, new.game_id, new.post_id, new.id);
    end if;
  end if;

  if v_owner is not null and v_owner <> new.author_id and v_owner is distinct from v_parent_author then
    insert into public.notifications (user_id, type, actor_id, game_id, post_id, comment_id)
    values (v_owner, 'comment', new.author_id, new.game_id, new.post_id, new.id);
  end if;
  return new;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function private.notify_comment();

create function private.notify_helpful() returns trigger
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
      values (new.author_id, 'helpful', v_owner, new.game_id, new.post_id, new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_notify_helpful
  after update of is_helpful on public.comments
  for each row execute function private.notify_helpful();

create function private.notify_game_like() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select g.owner_id into v_owner from public.games g where g.id = new.game_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.notifications (user_id, type, actor_id, game_id) values (v_owner, 'like', new.user_id, new.game_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger game_likes_notify
  after insert on public.game_likes
  for each row execute function private.notify_game_like();

create function private.notify_post_like() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select p.author_id into v_owner from public.posts p where p.id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.notifications (user_id, type, actor_id, post_id) values (v_owner, 'like', new.user_id, new.post_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger post_likes_notify
  after insert on public.post_likes
  for each row execute function private.notify_post_like();

create function private.notify_follow() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, actor_id) values (new.followee_id, 'follow', new.follower_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger follows_notify
  after insert on public.follows
  for each row execute function private.notify_follow();

create function private.notify_version() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.status = old.status or new.status not in ('ready', 'error') then
    return new;
  end if;
  select g.owner_id into v_owner from public.games g where g.id = new.game_id;
  if v_owner is not null then
    insert into public.notifications (user_id, type, game_id, version_id, data)
    values (
      v_owner,
      case new.status when 'ready' then 'version_ready' else 'version_error' end,
      new.game_id,
      new.id,
      case new.status when 'error' then jsonb_build_object('error_code', new.error_code) else '{}'::jsonb end
    );
  end if;
  return new;
end;
$$;

create trigger game_versions_notify
  after update of status on public.game_versions
  for each row execute function private.notify_version();

revoke all on function private.notify_comment(), private.notify_helpful(), private.notify_game_like(),
  private.notify_post_like(), private.notify_follow(), private.notify_version() from public;
