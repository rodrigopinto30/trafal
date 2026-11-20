-- ---------------------------------------------------------------------------------------------
-- Admins name other admins, and take the role away, only through an audited function.
--
--   set_account_role(user, role, reason)   user -> admin, or admin -> user
--
-- It needs an admin whose account is active and never acts on oneself: another admin does it. Since the caller stays an admin,
-- there is always at least one; role changes run one at a time (two admins taking the role away from each other at the same
-- moment could otherwise leave none), and the caller is checked again once it is their turn. A suspended account cannot become an
-- admin (and an admin cannot be suspended, see suspend_account). It runs in one transaction, leaves a line in moderation_log
-- (grant_admin / revoke_admin) and tells the person through a notification (type moderation) with the reason, without naming the
-- admin. Nothing is deleted.
--
-- The first admin of a new installation is named by hand, once, from the SQL editor (see docs/DESARROLLO.md).
-- ---------------------------------------------------------------------------------------------

create function public.set_account_role(p_user uuid, p_role text, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_current text;
begin
  if p_role is null or p_role not in ('user', 'admin') then
    raise exception 'invalid_role';
  end if;
  if char_length(v_reason) not between 1 and 500 then
    raise exception 'reason_required';
  end if;
  if p_user is null or p_user = v_admin then
    raise exception 'cannot_change_own_role';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.set_account_role'));
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select pp.role into v_current from public.profile_private pp where pp.id = p_user for update;
  if v_current is null then
    raise exception 'account_not_found';
  end if;
  if v_current = p_role then
    raise exception 'role_unchanged';
  end if;
  if p_role = 'admin' and private.is_suspended(p_user) then
    raise exception 'cannot_promote_suspended';
  end if;

  update public.profile_private set role = p_role where id = p_user;

  perform private.log_moderation(v_admin, case p_role when 'admin' then 'grant_admin' else 'revoke_admin' end, 'profile', p_user, v_reason);
  insert into public.notifications (user_id, type, data)
  values (
    p_user,
    'moderation',
    jsonb_build_object('action', case p_role when 'admin' then 'admin_granted' else 'admin_revoked' end, 'target_type', 'profile', 'reason', v_reason)
  );
end;
$$;

revoke all on function public.set_account_role(uuid, text, text) from public;
grant execute on function public.set_account_role(uuid, text, text) to authenticated;
