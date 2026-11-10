-- ---------------------------------------------------------------------------------------------
-- Account deletion.
--
-- A person deletes their own account (and nobody else's) with delete_my_account(): the auth user goes, and every foreign key that
-- points at the profile cascades, so the games, updates, comments, reactions, saves, follows, reports they sent, notifications and
-- usage log disappear with it. What stays on purpose: moderation_log (append-only accountability, no foreign key), and the
-- copyright claims about their content (the claimant's record; the link to the game is cleared).
--
-- The files are not in the database: they live in object storage, which a SQL function cannot (and must not) touch.
-- account_files() lists the folders the account owns so the server can empty them, one by one, with the storage credentials. The
-- server asks for the list BEFORE deleting, because afterwards the rows that say what exists are gone.
--
-- Admins cannot delete their own account: they stop being admins first (somebody else, or the database, does it), so the site can
-- never lose its last admin by a click.
-- ---------------------------------------------------------------------------------------------

create function public.account_files() returns table (bucket text, prefix text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'media', 'avatars/' || a.uid::text || '/' from (select (select auth.uid()) as uid) a where a.uid is not null
  union all
  select 'media', 'covers/' || a.uid::text || '/' from (select (select auth.uid()) as uid) a where a.uid is not null
  union all
  select 'media', 'screenshots/' || g.id::text || '/' from public.games g where g.owner_id = (select auth.uid())
  union all
  select 'media', 'posts/' || p.id::text || '/'
    from public.posts p
   where p.author_id = (select auth.uid())
      or p.game_id in (select g.id from public.games g where g.owner_id = (select auth.uid()))
  union all
  select 'quarantine', g.id::text || '/' from public.games g where g.owner_id = (select auth.uid())
  union all
  select 'games', g.public_id || '/' from public.games g where g.owner_id = (select auth.uid())
$$;

create function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if private.is_admin() then
    raise exception 'admin_cannot_delete';
  end if;

  delete from public.notifications where actor_id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.account_files() from public;
revoke all on function public.delete_my_account() from public;
grant execute on function public.account_files() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
