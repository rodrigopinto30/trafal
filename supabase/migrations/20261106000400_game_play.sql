-- ---------------------------------------------------------------------------------------------
-- Playing games.
--
-- game_delivery(public_id): what the games gateway needs to serve a game: whether it is published (and which version and entry
-- file to serve) or gone (hidden or taken down by moderation, so the gateway answers 410). Drafts and unknown ids return
-- nothing: the gateway cannot tell them apart and must answer 404. It is SECURITY DEFINER because the gateway runs with the
-- public API key and moderated games are invisible to it.
--
-- start_play(public_id, session, device): records the start of a play and bumps the game's counter, once per page session
-- (the unique index on plays absorbs reloads and retries). Visitors can play, so it is open to anon. No IP and no user agent
-- are stored, only the device class and, if signed in, the profile.
--
-- play_heartbeat(public_id, session): called every ~30 s while the tab is visible; adds the time since the last beat, at most
-- 35 s per beat and never more than one beat every 10 s, so the average play time cannot be inflated by calling it in a loop.
--
-- Known limit: nothing stops someone from opening many sessions to inflate the counter. Rate limits arrive with abuse controls.
-- ---------------------------------------------------------------------------------------------

create function public.game_delivery(p_public_id text)
returns table (state text, version_number integer, needs_isolation boolean, entry_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when g.status = 'published' then 'published' else 'gone' end,
    v.number,
    v.needs_isolation,
    v.entry_path
  from public.games g
  left join public.game_versions v on v.id = g.active_version_id and v.status = 'ready'
  where g.public_id = p_public_id
    and g.status in ('published', 'hidden', 'removed')
    and (g.status <> 'published' or v.id is not null);
$$;

create function public.start_play(p_public_id text, p_session_id uuid, p_device text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
  v_version_id uuid;
  v_inserted integer;
begin
  if p_device is null or p_device not in ('desktop', 'mobile', 'tablet') then
    raise exception 'invalid_device';
  end if;
  if p_session_id is null then
    raise exception 'invalid_session';
  end if;

  select g.id, g.active_version_id into v_game_id, v_version_id
  from public.games g
  where g.public_id = p_public_id and g.status = 'published';
  if not found then
    raise exception 'game_not_found';
  end if;

  insert into public.plays (game_id, version_id, user_id, session_id, device)
  values (
    v_game_id,
    v_version_id,
    (select p.id from public.profiles p where p.id = (select auth.uid())),
    p_session_id,
    p_device
  )
  on conflict (game_id, session_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.games g set play_count = g.play_count + 1 where g.id = v_game_id;
  end if;
end;
$$;

create function public.play_heartbeat(p_public_id text, p_session_id uuid) returns void
language sql
security definer
set search_path = ''
as $$
  update public.plays p
  set active_seconds = least(
        p.active_seconds + least(greatest(extract(epoch from now() - p.last_beat_at)::integer, 0), 35),
        14400
      ),
      last_beat_at = now()
  from public.games g
  where g.id = p.game_id
    and g.public_id = p_public_id
    and p.session_id = p_session_id
    and p.last_beat_at <= now() - interval '10 seconds';
$$;

revoke all on function public.game_delivery(text) from public;
revoke all on function public.start_play(text, uuid, text) from public;
revoke all on function public.play_heartbeat(text, uuid) from public;
grant execute on function public.game_delivery(text) to anon, authenticated;
grant execute on function public.start_play(text, uuid, text) to anon, authenticated;
grant execute on function public.play_heartbeat(text, uuid) to anon, authenticated;
