-- ---------------------------------------------------------------------------------------------
-- Suspending and reinstating accounts, only through audited functions.
--
-- A suspended account can still sign in and read, but cannot write anything (private.can_write() already enforces it in every
-- policy): no updates, comments, reports, follows, likes or uploads. It lasts until a date or, with no date, until an admin lifts
-- it; a suspension whose date has passed stops counting by itself.
--
--   suspend_account(user, reason, until)  active -> suspended, with a reason the person reads and an optional end date
--   lift_suspension(user, reason)          suspended -> active
--
-- Both need an admin whose account is active, never act on an admin or on oneself, run in one transaction, leave a line in
-- moderation_log and tell the person through a notification (type moderation) with the reason, without naming the admin.
-- ---------------------------------------------------------------------------------------------

create function private.is_suspended(p_user uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pp.status = 'suspended' and (pp.suspended_until is null or pp.suspended_until > now())
    from public.profile_private pp
    where pp.id = p_user
  ), false);
$$;

create function private.notify_suspension(p_user uuid, p_action text, p_reason text, p_until timestamptz) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, data)
  values (
    p_user,
    'moderation',
    jsonb_build_object('action', p_action, 'target_type', 'profile', 'reason', p_reason, 'until', p_until)
  );
$$;

create function public.suspend_account(p_user uuid, p_reason text, p_until timestamptz default null) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_role text;
begin
  if char_length(v_reason) not between 1 and 500 then
    raise exception 'reason_required';
  end if;
  if p_user = v_admin then
    raise exception 'cannot_suspend_self';
  end if;
  select pp.role into v_role from public.profile_private pp where pp.id = p_user for update;
  if v_role is null then
    raise exception 'account_not_found';
  end if;
  if v_role = 'admin' then
    raise exception 'cannot_suspend_admin';
  end if;
  if p_until is not null and p_until <= now() then
    raise exception 'invalid_until';
  end if;
  if private.is_suspended(p_user) then
    raise exception 'already_suspended';
  end if;

  update public.profile_private
     set status = 'suspended', suspended_until = p_until, suspension_reason = v_reason
   where id = p_user;

  perform private.log_moderation(
    v_admin, 'suspend_account', 'profile', p_user,
    v_reason || case when p_until is null then ' (no end date)' else ' (until ' || to_char(p_until at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC)' end
  );
  perform private.notify_suspension(p_user, 'suspend', v_reason, p_until);
end;
$$;

create function public.lift_suspension(p_user uuid, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) not between 1 and 500 then
    raise exception 'reason_required';
  end if;
  if not exists (select 1 from public.profile_private pp where pp.id = p_user) then
    raise exception 'account_not_found';
  end if;
  if not private.is_suspended(p_user) then
    raise exception 'not_suspended';
  end if;

  update public.profile_private
     set status = 'active', suspended_until = null, suspension_reason = null
   where id = p_user;

  perform private.log_moderation(v_admin, 'lift_suspension', 'profile', p_user, v_reason);
  perform private.notify_suspension(p_user, 'lift', v_reason, null);
end;
$$;

revoke all on function private.is_suspended(uuid) from public;
revoke all on function private.notify_suspension(uuid, text, text, timestamptz) from public;
revoke all on function public.suspend_account(uuid, text, timestamptz) from public;
revoke all on function public.lift_suspension(uuid, text) from public;
grant execute on function public.suspend_account(uuid, text, timestamptz) to authenticated;
grant execute on function public.lift_suspension(uuid, text) to authenticated;
