-- ---------------------------------------------------------------------------------------------
-- Appeals: asking for a moderation decision to be reviewed.
--
-- A person can appeal the two things an admin can do to them: suspending their account, or hiding something of theirs (a game,
-- an update, a comment). Both are reversible, so an appeal asks an admin to look again, and the admin either keeps the decision
-- (upheld) or reverses it (overturned: the suspension is lifted, the content is back).
--
--   my_decisions()                         what is decided about me right now, and which of it I already appealed
--   submit_appeal(type, id, message)       the person whose account is suspended, or who owns what was hidden
--   resolve_appeal(appeal, outcome, note)  an admin, with an answer that the person reads
--
-- Nobody writes to `appeals` directly: appealing has to work for a suspended account (which cannot write anything), and resolving
-- is a moderation action, so both go through functions. The decision being appealed is copied into the appeal (the line of the
-- moderation log that records it, its reason and when it was taken), so the screen needs nothing else and nothing changes under it.
--
-- One appeal per decision: while one is open, or if one was already made about the latest decision, there is no second one. If the
-- content is hidden again later, that is a new decision (a new line of the log) and can be appealed.
-- ---------------------------------------------------------------------------------------------

alter table public.moderation_log drop constraint moderation_log_target_type_check;
alter table public.moderation_log add constraint moderation_log_target_type_check
  check (target_type in ('game', 'post', 'comment', 'profile', 'report', 'claim', 'featured', 'appeal'));

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  appellant_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'game', 'post', 'comment')),
  target_id uuid not null,
  target_label text not null default '' check (char_length(target_label) <= 120),
  decision_log_id bigint,
  decision_reason text check (decision_reason is null or char_length(decision_reason) <= 1000),
  decision_at timestamptz,
  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint appeals_resolution_matches_status check ((status = 'open') = (resolved_at is null))
);

create unique index appeals_one_open_per_target on public.appeals (appellant_id, target_type, target_id) where status = 'open';
create index appeals_queue_idx on public.appeals (status, created_at);
create index appeals_appellant_idx on public.appeals (appellant_id, created_at desc);

alter table public.appeals enable row level security;

create policy appeals_select on public.appeals
  for select to authenticated using (appellant_id = (select auth.uid()) or private.is_admin());

revoke all on public.appeals from anon, authenticated;
grant select on public.appeals to authenticated;

-- ---------------------------------------------------------------------------------------------

create function private.publish_hidden(p_target_type text, p_target_id uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer := 0;
begin
  if p_target_type = 'game' then
    update public.games set status = 'published' where id = p_target_id and status = 'hidden';
  elsif p_target_type = 'post' then
    update public.posts set status = 'published' where id = p_target_id and status = 'hidden';
  elsif p_target_type = 'comment' then
    update public.comments set status = 'published' where id = p_target_id and status = 'hidden';
  end if;
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

-- The decisions in force about a person: their suspension, and what of theirs is hidden, each with the reason of the latest decision
-- (the line of the moderation log that records it) and the appeal already made about that very decision, if any.
create function private.my_decisions(p_user uuid) returns table (
  target_type text, target_id uuid, label text, reason text, decided_at timestamptz, decision_log_id bigint, appeal_id uuid, appeal_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  with decisions as (
    select 'profile'::text as target_type, pp.id as target_id, ''::text as label, pp.suspension_reason as reason, l.created_at as decided_at, l.id as decision_log_id
      from public.profile_private pp
      left join lateral (
        select m.id, m.created_at from public.moderation_log m
         where m.action = 'suspend_account' and m.target_type = 'profile' and m.target_id = pp.id order by m.id desc limit 1
      ) l on true
     where pp.id = p_user and private.is_suspended(p_user)
    union all
    select 'game', g.id, left(g.title, 120), l.reason, l.created_at, l.id
      from public.games g
      join lateral (
        select m.id, m.reason, m.created_at from public.moderation_log m
         where m.action = 'hide_game' and m.target_type = 'game' and m.target_id = g.id order by m.id desc limit 1
      ) l on true
     where g.owner_id = p_user and g.status = 'hidden'
    union all
    select 'post', x.id, left(x.body, 120), l.reason, l.created_at, l.id
      from public.posts x
      join lateral (
        select m.id, m.reason, m.created_at from public.moderation_log m
         where m.action = 'hide_post' and m.target_type = 'post' and m.target_id = x.id order by m.id desc limit 1
      ) l on true
     where x.author_id = p_user and x.status = 'hidden'
    union all
    select 'comment', c.id, left(c.body, 120), l.reason, l.created_at, l.id
      from public.comments c
      join lateral (
        select m.id, m.reason, m.created_at from public.moderation_log m
         where m.action = 'hide_comment' and m.target_type = 'comment' and m.target_id = c.id order by m.id desc limit 1
      ) l on true
     where c.author_id = p_user and c.status = 'hidden'
  )
  select d.target_type, d.target_id, d.label, d.reason, d.decided_at, d.decision_log_id, a.id, a.status
    from decisions d
    left join lateral (
      select ap.id, ap.status from public.appeals ap
       where ap.appellant_id = p_user and ap.target_type = d.target_type and ap.target_id = d.target_id
         and ap.decision_log_id is not distinct from d.decision_log_id
       order by ap.created_at desc limit 1
    ) a on true
$$;

create function public.my_decisions() returns table (
  target_type text, target_id uuid, label text, reason text, decided_at timestamptz, appeal_id uuid, appeal_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.target_type, d.target_id, d.label, d.reason, d.decided_at, d.appeal_id, d.appeal_status
    from private.my_decisions((select auth.uid())) d
   where (select auth.uid()) is not null
   order by d.decided_at desc nulls last
$$;

create function public.submit_appeal(p_target_type text, p_target_id uuid, p_message text) returns uuid
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
  if (select count(*) from public.appeals a where a.appellant_id = v_user and a.status = 'open') >= 5 then
    raise exception 'too_many_open';
  end if;

  insert into public.appeals (appellant_id, target_type, target_id, target_label, decision_log_id, decision_reason, decision_at, message)
  values (v_user, p_target_type, p_target_id, v_decision.label, v_decision.decision_log_id, v_decision.reason, v_decision.decided_at, v_message)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.resolve_appeal(p_appeal_id uuid, p_outcome text, p_note text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_note text := btrim(coalesce(p_note, ''));
  v_appeal public.appeals;
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

  if p_outcome = 'overturned' then
    if v_appeal.target_type = 'profile' then
      if private.is_suspended(v_appeal.target_id) then
        update public.profile_private
           set status = 'active', suspended_until = null, suspension_reason = null
         where id = v_appeal.target_id;
        perform private.log_moderation(v_admin, 'lift_suspension', 'profile', v_appeal.target_id, left('Appeal: ' || v_note, 1000));
      end if;
    else
      if private.publish_hidden(v_appeal.target_type, v_appeal.target_id) then
        perform private.log_moderation(v_admin, 'restore_' || v_appeal.target_type, v_appeal.target_type, v_appeal.target_id, left('Appeal: ' || v_note, 1000));
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
    jsonb_build_object('action', 'appeal_' || p_outcome, 'target_type', v_appeal.target_type, 'note', v_note)
  );
end;
$$;

revoke all on function private.publish_hidden(text, uuid) from public;
revoke all on function private.my_decisions(uuid) from public;
revoke all on function public.my_decisions() from public;
grant execute on function public.my_decisions() to authenticated;
revoke all on function public.submit_appeal(text, uuid, text) from public;
revoke all on function public.resolve_appeal(uuid, text, text) from public;
grant execute on function public.submit_appeal(text, uuid, text) to authenticated;
grant execute on function public.resolve_appeal(uuid, text, text) to authenticated;
