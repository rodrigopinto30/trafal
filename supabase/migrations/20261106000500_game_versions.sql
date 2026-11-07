-- ---------------------------------------------------------------------------------------------
-- Choosing which version of a game is the one people play.
--
-- The worker makes the first ready version the active one; later versions stay as they are until the owner decides.
-- set_active_version(version) is the owner's way to switch (to a newer version or back to an older one). Only a READY
-- version of one of the caller's own games can be chosen. games.active_version_id has no column grant: this function is the only
-- way to change it besides the worker's first-version rule, and the games trigger still checks that the version belongs
-- to the game and is ready.
-- ---------------------------------------------------------------------------------------------

create function public.set_active_version(p_version_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_game_id uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.can_write() then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  select v.game_id, v.status into v_game_id, v_status
  from public.game_versions v
  join public.games g on g.id = v.game_id
  where v.id = p_version_id and g.owner_id = v_uid;
  if not found then
    raise exception 'version_not_found';
  end if;
  if v_status <> 'ready' then
    raise exception 'version_not_ready';
  end if;

  update public.games g set active_version_id = p_version_id where g.id = v_game_id;
end;
$$;

revoke all on function public.set_active_version(uuid) from public;
grant execute on function public.set_active_version(uuid) to authenticated;
