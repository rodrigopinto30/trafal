-- ---------------------------------------------------------------------------------------------
-- Usage limits: how much one person can do in a period, enforced by the database.
--
-- Every limited action leaves a row in usage_events (written only by the triggers below, inside the transaction of the action),
-- and before the action is allowed the database counts the person's events of that kind in each window. Over the limit, the
-- action is refused with `usage_limit_exceeded` (detail: the action, hint: seconds until a slot frees up).
--
--   comment   8 a minute,   150 a day          follow   100 an hour,   400 a day
--   post      10 an hour,    30 a day          like     300 an hour
--   report    10 an hour,    30 a day          save     300 an hour
--   game      10 a day (drafts created)        avatar    10 a day (profile photo changes)
--
-- (Uploading versions has its own limit of 5 a day inside create_game_version.)
--
-- Only requests of a signed-in person count: the system (seeds, the worker, migrations) has no auth.uid() and is not limited, and
-- neither are admins. Failed or invalid attempts do not count: the usage trigger runs after the validation ones, and a refused
-- action rolls its event back. Counting here, and not in the tables of the content, makes deleting what was just posted useless
-- for getting around a limit.
-- ---------------------------------------------------------------------------------------------

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (char_length(action) between 1 and 30),
  created_at timestamptz not null default now()
);

create index usage_events_user_action_idx on public.usage_events (user_id, action, created_at desc);

alter table public.usage_events enable row level security;
revoke all on public.usage_events from anon, authenticated;

create function private.usage_limits() returns table (action text, max_events integer, window_seconds integer)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    ('comment', 8, 60),
    ('comment', 150, 86400),
    ('post', 10, 3600),
    ('post', 30, 86400),
    ('report', 10, 3600),
    ('report', 30, 86400),
    ('follow', 100, 3600),
    ('follow', 400, 86400),
    ('like', 300, 3600),
    ('save', 300, 3600),
    ('game', 10, 86400),
    ('avatar', 10, 86400)
  ) as limits (action, max_events, window_seconds);
$$;

create function private.apply_usage(p_user uuid, p_action text, p_record boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit record;
  v_count integer;
  v_retry numeric;
  v_wait numeric := 0;
  v_blocked boolean := false;
begin
  if (select auth.uid()) is null or private.is_admin() then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_action, 0));
  delete from public.usage_events where user_id = p_user and created_at < now() - interval '2 days';

  for v_limit in select * from private.usage_limits() l where l.action = p_action loop
    select count(*) into v_count
    from public.usage_events e
    where e.user_id = p_user and e.action = p_action and e.created_at > now() - make_interval(secs => v_limit.window_seconds);

    if v_count >= v_limit.max_events then
      select extract(epoch from (o.created_at + make_interval(secs => v_limit.window_seconds) - now())) into v_retry
      from (
        select e.created_at
        from public.usage_events e
        where e.user_id = p_user and e.action = p_action and e.created_at > now() - make_interval(secs => v_limit.window_seconds)
        order by e.created_at
        offset (v_count - v_limit.max_events) limit 1
      ) o;
      v_wait := greatest(v_wait, coalesce(v_retry, v_limit.window_seconds));
      v_blocked := true;
    end if;
  end loop;

  if v_blocked then
    raise exception 'usage_limit_exceeded' using detail = p_action, hint = greatest(ceil(v_wait), 1)::integer::text;
  end if;
  if p_record then
    insert into public.usage_events (user_id, action) values (p_user, p_action);
  end if;
end;
$$;

create function private.enforce_usage() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.apply_usage((to_jsonb(new) ->> tg_argv[1])::uuid, tg_argv[0], true);
  return new;
end;
$$;

create trigger comments_usage before insert on public.comments
  for each row execute function private.enforce_usage('comment', 'author_id');
create trigger posts_usage before insert on public.posts
  for each row execute function private.enforce_usage('post', 'author_id');
create trigger reports_usage before insert on public.reports
  for each row execute function private.enforce_usage('report', 'reporter_id');
create trigger follows_usage before insert on public.follows
  for each row execute function private.enforce_usage('follow', 'follower_id');
create trigger game_likes_usage before insert on public.game_likes
  for each row execute function private.enforce_usage('like', 'user_id');
create trigger post_likes_usage before insert on public.post_likes
  for each row execute function private.enforce_usage('like', 'user_id');
create trigger game_saves_usage before insert on public.game_saves
  for each row execute function private.enforce_usage('save', 'user_id');
create trigger post_saves_usage before insert on public.post_saves
  for each row execute function private.enforce_usage('save', 'user_id');
create trigger games_usage before insert on public.games
  for each row execute function private.enforce_usage('game', 'owner_id');

create function private.enforce_avatar_usage() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.apply_usage(new.id, 'avatar', true);
  return new;
end;
$$;

create trigger profiles_avatar_usage before update of avatar_path on public.profiles
  for each row
  when (new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path)
  execute function private.enforce_avatar_usage();

-- Asks, without recording anything, whether the person may do the action now. The server uses it before the expensive part of an
-- action that has one (storing a photo), so a refusal comes before the bytes are handled and not after.
create function public.check_usage(p_action text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from private.usage_limits() l where l.action = p_action) then
    raise exception 'unknown_action';
  end if;
  perform private.apply_usage(v_uid, p_action, false);
end;
$$;

revoke all on function private.usage_limits() from public;
revoke all on function private.apply_usage(uuid, text, boolean) from public;
revoke all on function private.enforce_usage() from public;
revoke all on function private.enforce_avatar_usage() from public;
revoke all on function public.check_usage(text) from public;
grant execute on function public.check_usage(text) to authenticated;
