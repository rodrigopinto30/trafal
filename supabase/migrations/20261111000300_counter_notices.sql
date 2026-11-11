-- ---------------------------------------------------------------------------------------------
-- Counter-notices: the answer of whoever published what a copyright claim got hidden.
--
-- A counter-notice is an appeal with more: the person says, with their name and a contact email, that they believe in good faith that
-- the content was hidden by mistake or misidentification and that what they say is accurate. It lives in `appeals` (same queue, same
-- answers: the admin keeps the content hidden or restores it, always with a written answer that the person reads), marked with
-- kind = 'counter_notice' and the claim it answers.
--
-- Only content hidden BECAUSE OF a claim has this path. A claim that hides something does it in one transaction, so the claim's
-- handled_at equals the moment of the line that records the hiding in moderation_log; that is how a decision is known to come from a
-- claim (private.my_decisions flags it). For those decisions a plain appeal is refused: the person has to send the counter-notice.
--
-- The admin sees the claimant's and the person's contact details side by side and puts them in touch by hand; nothing is sent to the
-- claimant automatically, and the claimant's details are never shown to the person.
-- ---------------------------------------------------------------------------------------------

alter table public.appeals
  add column kind text not null default 'appeal' check (kind in ('appeal', 'counter_notice')),
  add column claim_id uuid references public.copyright_claims (id) on delete set null,
  add column counter_name text check (counter_name is null or char_length(counter_name) between 1 and 200),
  add column counter_email text check (counter_email is null or char_length(counter_email) between 3 and 254),
  add column counter_good_faith boolean,
  add column counter_accuracy boolean,
  add constraint appeals_counter_notice_complete check (
    kind = 'appeal' or (counter_name is not null and counter_email is not null and counter_good_faith is true and counter_accuracy is true)
  );

drop function public.my_decisions();
drop function private.my_decisions(uuid);

create function private.my_decisions(p_user uuid) returns table (
  target_type text, target_id uuid, label text, reason text, decided_at timestamptz, decision_log_id bigint, claim_id uuid, appeal_id uuid, appeal_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  with decisions as (
    select 'profile'::text as target_type, pp.id as target_id, ''::text as label, pp.suspension_reason as reason, l.created_at as decided_at,
           l.id as decision_log_id, null::uuid as claim_id
      from public.profile_private pp
      left join lateral (
        select m.id, m.created_at from public.moderation_log m
         where m.action = 'suspend_account' and m.target_type = 'profile' and m.target_id = pp.id order by m.id desc limit 1
      ) l on true
     where pp.id = p_user and private.is_suspended(p_user)
    union all
    select 'game', g.id, left(g.title, 120), l.reason, l.created_at, l.id,
           (select c.id from public.copyright_claims c where c.game_id = g.id and c.status = 'actioned' and c.handled_at = l.created_at order by c.created_at desc limit 1)
      from public.games g
      join lateral (
        select m.id, m.reason, m.created_at from public.moderation_log m
         where m.action = 'hide_game' and m.target_type = 'game' and m.target_id = g.id order by m.id desc limit 1
      ) l on true
     where g.owner_id = p_user and g.status = 'hidden'
    union all
    select 'post', x.id, left(x.body, 120), l.reason, l.created_at, l.id,
           (select c.id from public.copyright_claims c where c.post_id = x.id and c.status = 'actioned' and c.handled_at = l.created_at order by c.created_at desc limit 1)
      from public.posts x
      join lateral (
        select m.id, m.reason, m.created_at from public.moderation_log m
         where m.action = 'hide_post' and m.target_type = 'post' and m.target_id = x.id order by m.id desc limit 1
      ) l on true
     where x.author_id = p_user and x.status = 'hidden'
    union all
    select 'comment', c.id, left(c.body, 120), l.reason, l.created_at, l.id, null::uuid
      from public.comments c
      join lateral (
        select m.id, m.reason, m.created_at from public.moderation_log m
         where m.action = 'hide_comment' and m.target_type = 'comment' and m.target_id = c.id order by m.id desc limit 1
      ) l on true
     where c.author_id = p_user and c.status = 'hidden'
  )
  select d.target_type, d.target_id, d.label, d.reason, d.decided_at, d.decision_log_id, d.claim_id, a.id, a.status
    from decisions d
    left join lateral (
      select ap.id, ap.status from public.appeals ap
       where ap.appellant_id = p_user and ap.target_type = d.target_type and ap.target_id = d.target_id
         and ap.decision_log_id is not distinct from d.decision_log_id
       order by ap.created_at desc limit 1
    ) a on true
$$;

create function public.my_decisions() returns table (
  target_type text, target_id uuid, label text, reason text, decided_at timestamptz, copyright boolean, appeal_id uuid, appeal_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.target_type, d.target_id, d.label, d.reason, d.decided_at, d.claim_id is not null, d.appeal_id, d.appeal_status
    from private.my_decisions((select auth.uid())) d
   where (select auth.uid()) is not null
   order by d.decided_at desc nulls last
$$;

revoke all on function private.my_decisions(uuid) from public;
revoke all on function public.my_decisions() from public;
grant execute on function public.my_decisions() to authenticated;

create or replace function public.submit_appeal(p_target_type text, p_target_id uuid, p_message text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_message text := btrim(coalesce(p_message, ''));
  v_decision record;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_message) not between 1 and 1000 then
    raise exception 'message_required';
  end if;
  if p_target_type not in ('profile', 'game', 'post', 'comment') then
    raise exception 'invalid_target_type';
  end if;

  select d.* into v_decision from private.my_decisions(v_user) d where d.target_type = p_target_type and d.target_id = p_target_id;
  if not found then
    raise exception 'nothing_to_appeal';
  end if;
  if v_decision.appeal_id is not null then
    raise exception 'already_appealed';
  end if;
  if v_decision.claim_id is not null then
    raise exception 'counter_notice_required';
  end if;
  if (select count(*) from public.appeals a where a.appellant_id = v_user and a.status = 'open') >= 5 then
    raise exception 'too_many_open';
  end if;

  insert into public.appeals (appellant_id, target_type, target_id, target_label, decision_log_id, decision_reason, decision_at, message)
  values (v_user, p_target_type, p_target_id, v_decision.label, v_decision.decision_log_id, v_decision.reason, v_decision.decided_at, v_message)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.submit_counter_notice(
  p_target_type text,
  p_target_id uuid,
  p_message text,
  p_name text,
  p_email text,
  p_good_faith boolean,
  p_accuracy boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_message text := btrim(coalesce(p_message, ''));
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_decision record;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_message) not between 1 and 1000 then
    raise exception 'message_required';
  end if;
  if char_length(v_name) not between 1 and 200 then
    raise exception 'name_required';
  end if;
  if char_length(v_email) not between 3 and 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if p_good_faith is not true or p_accuracy is not true then
    raise exception 'statements_required';
  end if;
  if p_target_type not in ('game', 'post') then
    raise exception 'invalid_target_type';
  end if;

  select d.* into v_decision from private.my_decisions(v_user) d where d.target_type = p_target_type and d.target_id = p_target_id;
  if not found then
    raise exception 'nothing_to_appeal';
  end if;
  if v_decision.appeal_id is not null then
    raise exception 'already_appealed';
  end if;
  if v_decision.claim_id is null then
    raise exception 'not_a_claim';
  end if;
  if (select count(*) from public.appeals a where a.appellant_id = v_user and a.status = 'open') >= 5 then
    raise exception 'too_many_open';
  end if;

  insert into public.appeals (
    appellant_id, target_type, target_id, target_label, decision_log_id, decision_reason, decision_at, message,
    kind, claim_id, counter_name, counter_email, counter_good_faith, counter_accuracy
  ) values (
    v_user, p_target_type, p_target_id, v_decision.label, v_decision.decision_log_id, v_decision.reason, v_decision.decided_at, v_message,
    'counter_notice', v_decision.claim_id, v_name, v_email, true, true
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.resolve_appeal(p_appeal_id uuid, p_outcome text, p_note text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_note text := btrim(coalesce(p_note, ''));
  v_appeal public.appeals;
  v_prefix text;
begin
  if p_outcome not in ('upheld', 'overturned') then
    raise exception 'invalid_outcome';
  end if;
  if char_length(v_note) not between 1 and 1000 then
    raise exception 'reason_required';
  end if;

  select * into v_appeal from public.appeals a where a.id = p_appeal_id for update;
  if not found then
    raise exception 'appeal_not_found';
  end if;
  if v_appeal.status <> 'open' then
    raise exception 'appeal_already_resolved';
  end if;
  v_prefix := case when v_appeal.kind = 'counter_notice' then 'Counter-notice: ' else 'Appeal: ' end;

  if p_outcome = 'overturned' then
    if v_appeal.target_type = 'profile' then
      if private.is_suspended(v_appeal.target_id) then
        update public.profile_private
           set status = 'active', suspended_until = null, suspension_reason = null
         where id = v_appeal.target_id;
        perform private.log_moderation(v_admin, 'lift_suspension', 'profile', v_appeal.target_id, left(v_prefix || v_note, 1000));
      end if;
    else
      if private.publish_hidden(v_appeal.target_type, v_appeal.target_id) then
        perform private.log_moderation(v_admin, 'restore_' || v_appeal.target_type, v_appeal.target_type, v_appeal.target_id, left(v_prefix || v_note, 1000));
      end if;
    end if;
  end if;

  update public.appeals
     set status = p_outcome, resolution_note = v_note, resolved_by = v_admin, resolved_at = now()
   where id = p_appeal_id;

  perform private.log_moderation(v_admin, 'resolve_appeal', 'appeal', p_appeal_id, left(p_outcome || ': ' || v_note, 1000));

  insert into public.notifications (user_id, type, game_id, post_id, comment_id, data)
  values (
    v_appeal.appellant_id,
    'moderation',
    case when v_appeal.target_type = 'game' then v_appeal.target_id end,
    case when v_appeal.target_type = 'post' then v_appeal.target_id end,
    case when v_appeal.target_type = 'comment' then v_appeal.target_id end,
    jsonb_build_object('action', 'appeal_' || p_outcome, 'target_type', v_appeal.target_type, 'note', v_note, 'kind', v_appeal.kind)
  );
end;
$$;

revoke all on function public.submit_counter_notice(text, uuid, text, text, text, boolean, boolean) from public;
grant execute on function public.submit_counter_notice(text, uuid, text, text, text, boolean, boolean) to authenticated;
