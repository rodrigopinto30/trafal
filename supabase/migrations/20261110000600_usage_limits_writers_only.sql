-- Whoever cannot write (no profile yet, or suspended) is refused by the policies of the table, with their own error: the usage
-- limit does not get in front of that (it would also fail on the foreign key of the event for someone without a profile).
create or replace function private.apply_usage(p_user uuid, p_action text, p_record boolean) returns void
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
  if (select auth.uid()) is null or private.is_admin() or not private.can_write() then
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
