-- ---------------------------------------------------------------------------------------------
-- Game upload.
--
-- create_game_version(game, declared size, label, changelog): the only way to create a version. It checks that the caller
-- owns the game and may write, that the declared size fits the zip limit and that the daily upload quota is not used up,
-- picks the next version number and returns the quarantine key the browser must upload the zip to.
--
-- confirm_version_upload(version): the owner says "the zip is in quarantine". The version moves from `uploading` to
-- `processing`, which is what puts it in the worker queue. Nobody else changes a version's status: the owner cannot mark
-- it `ready`, only the worker can.
--
-- The limits below mirror packages/shared/upload-rules.json (a test keeps them in sync).
--
-- Also: the image paths stored on a game and on its screenshots are validated by the database (same folder rule as
-- profiles.avatar_path), so a game can only point to images that were uploaded for it.
-- ---------------------------------------------------------------------------------------------

create function public.create_game_version(
  p_game_id uuid,
  p_declared_size_bytes bigint,
  p_label text default null,
  p_changelog text default ''
)
returns table (version_id uuid, version_number integer, quarantine_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_zip_bytes constant bigint := 209715200;
  c_daily_uploads constant integer := 5;
  v_uid uuid := (select auth.uid());
  v_id uuid := gen_random_uuid();
  v_number integer;
  v_key text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.can_write() then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  perform 1 from public.games g where g.id = p_game_id and g.owner_id = v_uid for update;
  if not found then
    raise exception 'game_not_found';
  end if;

  if p_declared_size_bytes is null or p_declared_size_bytes <= 0 or p_declared_size_bytes > c_max_zip_bytes then
    raise exception 'invalid_size';
  end if;

  if (
    select count(*)
    from public.game_versions v
    join public.games g on g.id = v.game_id
    where g.owner_id = v_uid and v.created_at > now() - interval '24 hours'
  ) >= c_daily_uploads then
    raise exception 'daily_limit_reached';
  end if;

  select coalesce(max(v.number), 0) + 1 into v_number from public.game_versions v where v.game_id = p_game_id;
  v_key := p_game_id::text || '/' || v_id::text || '.zip';

  insert into public.game_versions (id, game_id, number, label, changelog, status, quarantine_key, declared_size_bytes)
  values (
    v_id,
    p_game_id,
    v_number,
    coalesce(nullif(btrim(p_label), ''), 'v' || v_number::text),
    coalesce(p_changelog, ''),
    'uploading',
    v_key,
    p_declared_size_bytes
  );

  return query select v_id, v_number, v_key;
end;
$$;

create function public.confirm_version_upload(p_version_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.can_write() then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  select v.status into v_status
  from public.game_versions v
  join public.games g on g.id = v.game_id
  where v.id = p_version_id and g.owner_id = v_uid
  for update of v;
  if not found then
    raise exception 'version_not_found';
  end if;
  if v_status <> 'uploading' then
    raise exception 'invalid_state';
  end if;

  update public.game_versions set status = 'processing', uploaded_at = now() where id = p_version_id;
end;
$$;

revoke all on function public.create_game_version(uuid, bigint, text, text) from public;
revoke all on function public.confirm_version_upload(uuid) from public;
grant execute on function public.create_game_version(uuid, bigint, text, text) to authenticated;
grant execute on function public.confirm_version_upload(uuid) to authenticated;

alter table public.games
  add constraint games_cover_path_fmt
  check (cover_path is null or cover_path ~ ('^covers/' || owner_id::text || '/[0-9a-f]{32}\.(webp|jpg|png)$'));

alter table public.game_screenshots
  add constraint game_screenshots_path_fmt
  check (path ~ ('^screenshots/' || game_id::text || '/[0-9a-f]{32}\.(webp|jpg|png)$'));
