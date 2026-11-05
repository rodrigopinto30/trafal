-- ---------------------------------------------------------------------------------------------
-- Game worker.
--
-- The Python worker takes uploaded game zips from the queue (versions in `processing`), validates them, publishes their
-- files and reports the result. It connects to Postgres as `game_worker`, a role that can do NOTHING except run the four
-- functions of the `worker` schema: it has no table privileges and the API (PostgREST) does not expose the schema.
-- The role is created without login: whoever runs the worker enables it with a password (./start.sh does it locally).
--
--   worker.claim_version     takes one version (FOR UPDATE SKIP LOCKED, so two workers never take the same one),
--                            gives up on versions that already used all their attempts
--   worker.complete_version  marks a version ready and makes it the game's active version if the game has none
--   worker.fail_version      marks a version as rejected, with a stable error code the interface translates
--   worker.release_version   gives a version back to the queue after a failure that is not the zip's fault
--
-- A version whose worker disappeared (lock older than the stale limit) is claimed again; after max attempts it fails with
-- PROCESSING_FAILED instead of looping forever.
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'game_worker') then
    create role game_worker nologin;
  end if;
end;
$$;

grant game_worker to postgres with set true;

create schema worker;
revoke all on schema worker from public;
grant usage on schema worker to game_worker;

create function worker.claim_version(
  p_worker text,
  p_stale_after interval default interval '10 minutes',
  p_max_attempts integer default 3
)
returns table (
  version_id uuid,
  game_id uuid,
  public_id text,
  version_number integer,
  quarantine_key text,
  declared_size_bytes bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.game_versions;
begin
  update public.game_versions v
  set status = 'error', error_code = 'PROCESSING_FAILED', error_params = '{}'::jsonb,
      locked_at = null, locked_by = null, processed_at = now()
  where v.status = 'processing'
    and v.attempts >= p_max_attempts
    and (v.locked_at is null or v.locked_at < now() - p_stale_after);

  select * into v_version
  from public.game_versions v
  where v.status = 'processing'
    and v.quarantine_key is not null
    and v.attempts < p_max_attempts
    and (v.locked_at is null or v.locked_at < now() - p_stale_after)
  order by v.uploaded_at nulls last, v.created_at
  for update skip locked
  limit 1;
  if not found then
    return;
  end if;

  update public.game_versions v
  set locked_at = now(), locked_by = left(p_worker, 64), attempts = v.attempts + 1
  where v.id = v_version.id;

  return query
  select v_version.id, v_version.game_id, g.public_id, v_version.number, v_version.quarantine_key, v_version.declared_size_bytes
  from public.games g
  where g.id = v_version.game_id;
end;
$$;

create function worker.complete_version(
  p_version_id uuid,
  p_file_count integer,
  p_unpacked_bytes bigint,
  p_size_bytes bigint,
  p_engine text,
  p_needs_isolation boolean,
  p_scan_flags jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
  v_status text;
begin
  select v.game_id, v.status into v_game_id, v_status from public.game_versions v where v.id = p_version_id for update;
  if not found then
    raise exception 'version_not_found';
  end if;
  if v_status <> 'processing' then
    raise exception 'invalid_state';
  end if;

  update public.game_versions v
  set status = 'ready',
      file_count = p_file_count,
      unpacked_bytes = p_unpacked_bytes,
      size_bytes = p_size_bytes,
      detected_engine = (select e.id from public.engines e where e.id = p_engine),
      needs_isolation = coalesce(p_needs_isolation, false),
      scan_flags = coalesce(p_scan_flags, '[]'::jsonb),
      error_code = null,
      error_params = '{}'::jsonb,
      processed_at = now(),
      locked_at = null,
      locked_by = null
  where v.id = p_version_id;

  update public.games g set active_version_id = p_version_id where g.id = v_game_id and g.active_version_id is null;
end;
$$;

create function worker.fail_version(
  p_version_id uuid,
  p_error_code text,
  p_error_params jsonb,
  p_scan_flags jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select v.status into v_status from public.game_versions v where v.id = p_version_id for update;
  if not found then
    raise exception 'version_not_found';
  end if;
  if v_status <> 'processing' then
    raise exception 'invalid_state';
  end if;
  if p_error_code is null or p_error_code !~ '^[A-Z][A-Z0-9_]{2,63}$' then
    raise exception 'invalid_error_code';
  end if;

  update public.game_versions v
  set status = 'error',
      error_code = p_error_code,
      error_params = case when pg_column_size(coalesce(p_error_params, '{}'::jsonb)) <= 2048 then coalesce(p_error_params, '{}'::jsonb) else '{}'::jsonb end,
      scan_flags = coalesce(p_scan_flags, '[]'::jsonb),
      processed_at = now(),
      locked_at = null,
      locked_by = null
  where v.id = p_version_id;
end;
$$;

create function worker.release_version(p_version_id uuid) returns void
language sql
security definer
set search_path = ''
as $$
  update public.game_versions v
  set locked_at = null, locked_by = null
  where v.id = p_version_id and v.status = 'processing';
$$;

revoke all on function worker.claim_version(text, interval, integer) from public;
revoke all on function worker.complete_version(uuid, integer, bigint, bigint, text, boolean, jsonb) from public;
revoke all on function worker.fail_version(uuid, text, jsonb, jsonb) from public;
revoke all on function worker.release_version(uuid) from public;
grant execute on function worker.claim_version(text, interval, integer) to game_worker;
grant execute on function worker.complete_version(uuid, integer, bigint, bigint, text, boolean, jsonb) to game_worker;
grant execute on function worker.fail_version(uuid, text, jsonb, jsonb) to game_worker;
grant execute on function worker.release_version(uuid) to game_worker;
