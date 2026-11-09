-- ---------------------------------------------------------------------------------------------
-- Choosing the first game of the week.
--
-- The table `featured_games` is public to read and has no direct write grant for anybody, not even admins: an admin picks through
-- set_featured_game(game, week, quote) and removes a pick through clear_featured_game(week). Both:
--   * need an admin whose account is active (private.is_admin());
--   * leave a line in moderation_log (append-only), so every change has an author, a date and the game it was about;
--   * only touch the current week or a coming one (up to 8 weeks ahead): past picks are history.
-- What can be featured is decided by the table's own trigger (a PUBLISHED game marked as the creator's first game), and a game can
-- be featured only once in its life (unique game_id): a second time raises game_already_featured.
-- The week always starts on a Monday; without a week, the current one is used. Choosing again for the same week replaces the pick.
-- ---------------------------------------------------------------------------------------------

create function public.set_featured_game(p_game_id uuid, p_week_start date default null, p_quote text default null) returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_this_week date := date_trunc('week', current_date)::date;
  v_week date := coalesce(p_week_start, v_this_week);
  v_quote text := nullif(btrim(coalesce(p_quote, '')), '');
  v_previous uuid;
  v_username text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if extract(isodow from v_week) <> 1 then
    raise exception 'week_not_monday';
  end if;
  if v_week < v_this_week then
    raise exception 'week_in_the_past';
  end if;
  if v_week > v_this_week + 56 then
    raise exception 'week_too_far';
  end if;

  select p.username into v_username from public.profiles p where p.id = v_uid;
  select f.game_id into v_previous from public.featured_games f where f.week_start = v_week;

  begin
    insert into public.featured_games (week_start, game_id, chosen_by, quote)
    values (v_week, p_game_id, v_uid, v_quote)
    on conflict (week_start) do update set game_id = excluded.game_id, chosen_by = excluded.chosen_by, quote = excluded.quote;
  exception when unique_violation then
    raise exception 'game_already_featured';
  end;

  insert into public.moderation_log (admin_id, admin_username, action, target_type, target_id, reason)
  values (v_uid, coalesce(v_username, ''), case when v_previous is null then 'feature_game' else 'replace_featured_game' end, 'featured', p_game_id, 'week ' || v_week);
  return v_week;
end;
$$;

create function public.clear_featured_game(p_week_start date default null) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_this_week date := date_trunc('week', current_date)::date;
  v_week date := coalesce(p_week_start, v_this_week);
  v_game uuid;
  v_username text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_week < v_this_week then
    raise exception 'week_in_the_past';
  end if;

  delete from public.featured_games f where f.week_start = v_week returning f.game_id into v_game;
  if v_game is null then
    return false;
  end if;

  select p.username into v_username from public.profiles p where p.id = v_uid;
  insert into public.moderation_log (admin_id, admin_username, action, target_type, target_id, reason)
  values (v_uid, coalesce(v_username, ''), 'unfeature_game', 'featured', v_game, 'week ' || v_week);
  return true;
end;
$$;

revoke all on function public.set_featured_game(uuid, date, text) from public;
revoke all on function public.clear_featured_game(date) from public;
grant execute on function public.set_featured_game(uuid, date, text) to authenticated;
grant execute on function public.clear_featured_game(date) to authenticated;
