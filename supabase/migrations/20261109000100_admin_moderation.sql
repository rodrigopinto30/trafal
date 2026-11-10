-- ---------------------------------------------------------------------------------------------
-- Moderation by admins, only through audited functions.
--
-- Admins never edit or delete what people publish: they HIDE it (status hidden) and can RESTORE it, which is reversible and
-- keeps the evidence. Every action below needs an admin whose account is active (private.is_admin()), runs in one
-- transaction and leaves a line in moderation_log (append-only): who, what, which target, why.
--
--   take_report(report)                    open -> reviewing
--   resolve_report(report, outcome, note)  reviewing/open -> dismissed | actioned | actioned by hiding the content
--   moderate_content(type, id, action, why) hide or restore a game, an update or a comment
--
-- Hiding or restoring tells the author through a notification (type moderation) with the reason, so nobody is moderated in
-- silence. The notification does not say which admin acted.
-- The tables `reports`, `games`, `posts` and `comments` keep having no write path for admins besides these functions.
-- ---------------------------------------------------------------------------------------------

create function private.require_admin() returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create function private.log_moderation(p_admin uuid, p_action text, p_target_type text, p_target_id uuid, p_reason text) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.moderation_log (admin_id, admin_username, action, target_type, target_id, reason)
  values (p_admin, coalesce((select p.username from public.profiles p where p.id = p_admin), ''), p_action, p_target_type, p_target_id, p_reason);
$$;

create function private.apply_moderation(p_admin uuid, p_target_type text, p_target_id uuid, p_action text, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_status text;
  v_owner uuid;
  v_to text;
begin
  if p_action not in ('hide', 'restore') then
    raise exception 'invalid_action';
  end if;
  if char_length(v_reason) not between 1 and 1000 then
    raise exception 'reason_required';
  end if;

  if p_target_type = 'game' then
    select g.status, g.owner_id into v_status, v_owner from public.games g where g.id = p_target_id;
  elsif p_target_type = 'post' then
    select x.status, x.author_id into v_status, v_owner from public.posts x where x.id = p_target_id;
  elsif p_target_type = 'comment' then
    select c.status, c.author_id into v_status, v_owner from public.comments c where c.id = p_target_id;
  else
    raise exception 'invalid_target_type';
  end if;
  if v_owner is null then
    raise exception 'target_not_found';
  end if;

  if p_action = 'hide' and v_status <> 'published' then
    raise exception 'invalid_status_for_action';
  end if;
  if p_action = 'restore' and v_status <> 'hidden' then
    raise exception 'invalid_status_for_action';
  end if;
  v_to := case p_action when 'hide' then 'hidden' else 'published' end;

  if p_target_type = 'game' then
    update public.games set status = v_to where id = p_target_id;
  elsif p_target_type = 'post' then
    update public.posts set status = v_to where id = p_target_id;
  else
    update public.comments set status = v_to where id = p_target_id;
  end if;

  perform private.log_moderation(p_admin, p_action || '_' || p_target_type, p_target_type, p_target_id, v_reason);

  insert into public.notifications (user_id, type, game_id, post_id, comment_id, data)
  values (
    v_owner,
    'moderation',
    case when p_target_type = 'game' then p_target_id end,
    case when p_target_type = 'post' then p_target_id end,
    case when p_target_type = 'comment' then p_target_id end,
    jsonb_build_object('action', p_action, 'target_type', p_target_type, 'reason', v_reason)
  );
end;
$$;

create function public.moderate_content(p_target_type text, p_target_id uuid, p_action text, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
begin
  perform private.apply_moderation(v_admin, p_target_type, p_target_id, p_action, p_reason);
end;
$$;

create function public.take_report(p_report_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_status text;
begin
  select r.status into v_status from public.reports r where r.id = p_report_id for update;
  if v_status is null then
    raise exception 'report_not_found';
  end if;
  if v_status <> 'open' then
    raise exception 'report_not_open';
  end if;
  update public.reports set status = 'reviewing' where id = p_report_id;
  perform private.log_moderation(v_admin, 'take_report', 'report', p_report_id, null);
end;
$$;

create function public.resolve_report(p_report_id uuid, p_outcome text, p_note text default null) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_report public.reports;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_outcome not in ('dismissed', 'actioned', 'hide_content') then
    raise exception 'invalid_outcome';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'note_too_long';
  end if;

  select * into v_report from public.reports r where r.id = p_report_id for update;
  if not found then
    raise exception 'report_not_found';
  end if;
  if v_report.status not in ('open', 'reviewing') then
    raise exception 'report_already_resolved';
  end if;

  if p_outcome = 'hide_content' then
    if v_report.target_type = 'profile' then
      raise exception 'cannot_hide_profile';
    end if;
    if v_note is null then
      raise exception 'reason_required';
    end if;
    perform private.apply_moderation(v_admin, v_report.target_type, v_report.target_id, 'hide', v_note);
  end if;

  update public.reports
     set status = case when p_outcome = 'dismissed' then 'dismissed' else 'actioned' end,
         resolved_by = v_admin,
         resolved_at = now(),
         resolution_note = v_note
   where id = p_report_id;
  perform private.log_moderation(v_admin, case when p_outcome = 'dismissed' then 'dismiss_report' else 'action_report' end, 'report', p_report_id, v_note);
end;
$$;

revoke all on function private.require_admin() from public;
revoke all on function private.log_moderation(uuid, text, text, uuid, text) from public;
revoke all on function private.apply_moderation(uuid, text, uuid, text, text) from public;
revoke all on function public.moderate_content(text, uuid, text, text) from public;
revoke all on function public.take_report(uuid) from public;
revoke all on function public.resolve_report(uuid, text, text) from public;
grant execute on function public.moderate_content(text, uuid, text, text) to authenticated;
grant execute on function public.take_report(uuid) to authenticated;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;
