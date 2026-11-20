-- ---------------------------------------------------------------------------------------------
-- Security review of 2026-11-19 (docs/SEGURIDAD.md): what the database now enforces itself.
--
-- 1. A game that moderation hid or removed stays as moderation left it: its owner can no longer change it, its questions or its
--    versions, upload new ones or switch the active one (edit_game already refused it; direct writes did not).
-- 2. A game that already has versions cannot be deleted directly: deleting it erased its versions (and so the daily upload
--    count) and left its published files behind. Account deletion still removes everything.
-- 3. Deleting an account needs a recent sign-in, checked here and not only by the web: the session's authentication methods
--    (`amr` in the JWT) must include one from the last 10 minutes.
-- 4. A copyright claim is only accepted with the web server's key (the server checks the captcha first): the function is open
--    to visitors, and without it anyone could skip the captcha. Its links must be http(s).
-- 5. Visitors and users no longer read internal columns: the worker's state of a version (lock, attempts, scan flags, the
--    quarantine key) and who chose the game of the week; the owner gets the upload target through a function.
-- 6. Future games of the week stay secret until their week starts, as the site already showed them.
-- 7. Usernames that contain the site's name, or a part that means the team (admin, soporte…), are reserved.
-- 8. Public text cannot hold control, invisible or direction-changing characters (the web already removed them; a direct
--    write did not), and single-line text cannot hold line breaks.
-- ---------------------------------------------------------------------------------------------

-- 1 ------------------------------------------------------------------------------------------
create function private.owns_editable_game(p_game_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.games g
    where g.id = p_game_id and g.owner_id = (select auth.uid()) and g.status in ('draft', 'published')
  );
$$;

revoke all on function private.owns_editable_game(uuid) from public;
grant execute on function private.owns_editable_game(uuid) to anon, authenticated;

alter policy games_update on public.games
  using (owner_id = (select auth.uid()) and status in ('draft', 'published') and private.can_write())
  with check (owner_id = (select auth.uid()) and status in ('draft', 'published') and private.can_write());

-- 2 ------------------------------------------------------------------------------------------
-- Outside row-level security on purpose: the versions' own policy reads games, and a policy of games reading the versions
-- through it would recurse.
create function private.game_has_versions(p_game_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.game_versions v where v.game_id = p_game_id);
$$;

revoke all on function private.game_has_versions(uuid) from public;
grant execute on function private.game_has_versions(uuid) to authenticated;

alter policy games_delete on public.games
  using (
    owner_id = (select auth.uid())
    and status in ('draft', 'published')
    and private.can_write()
    and not private.game_has_versions(id)
  );

alter policy game_questions_insert on public.game_questions
  with check (private.owns_editable_game(game_id) and private.can_write());
alter policy game_questions_update on public.game_questions
  using (private.owns_editable_game(game_id) and private.can_write())
  with check (private.owns_editable_game(game_id) and private.can_write());
alter policy game_questions_delete on public.game_questions
  using (private.owns_editable_game(game_id) and private.can_write());

alter policy game_versions_update_meta on public.game_versions
  using (private.owns_editable_game(game_id) and private.can_write())
  with check (private.owns_editable_game(game_id) and private.can_write());

-- A new version of one of the caller's draft or published games. The daily quota counts the caller's versions of the last 24 h;
-- the lock makes two calls of the same person wait for each other, so they cannot both pass the count.
create or replace function public.create_game_version(
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

  perform pg_advisory_xact_lock(hashtextextended('create_game_version:' || v_uid::text, 0));
  perform 1 from public.games g where g.id = p_game_id and g.owner_id = v_uid and g.status in ('draft', 'published') for update;
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

create or replace function public.confirm_version_upload(p_version_id uuid) returns void
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
  where v.id = p_version_id and g.owner_id = v_uid and g.status in ('draft', 'published')
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

create or replace function public.set_active_version(p_version_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_game_id uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.can_write() then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  select v.game_id, v.status into v_game_id, v_status
  from public.game_versions v
  join public.games g on g.id = v.game_id
  where v.id = p_version_id and g.owner_id = v_uid and g.status in ('draft', 'published');
  if not found then
    raise exception 'version_not_found';
  end if;
  if v_status <> 'ready' then
    raise exception 'version_not_ready';
  end if;

  update public.games g set active_version_id = p_version_id where g.id = v_game_id;
end;
$$;

-- 3 ------------------------------------------------------------------------------------------
-- Whether the session signed in (with any method: password, Google or Discord, an email link) within the given time.
create function private.recently_authenticated(p_within interval) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof((select auth.jwt()) -> 'amr') = 'array' then (select auth.jwt()) -> 'amr' else '[]'::jsonb end
    ) as method
    where (method ->> 'timestamp') ~ '^[0-9]{1,12}$'
      and (method ->> 'timestamp')::bigint >= extract(epoch from now() - p_within)
  );
$$;

revoke all on function private.recently_authenticated(interval) from public;
grant execute on function private.recently_authenticated(interval) to authenticated;

create or replace function public.delete_my_account() returns void
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
  if not private.recently_authenticated(interval '10 minutes') then
    raise exception 'reauthentication_required' using errcode = '42501';
  end if;

  delete from public.notifications where actor_id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

-- 4 ------------------------------------------------------------------------------------------
-- Keys that only trusted servers hold, stored as their SHA-256. `./start.sh` sets the local one; in production it is set once
-- from the SQL editor (docs/DESARROLLO.md). Nobody but the database owner can read or change the table.
create table private.server_keys (
  name text primary key,
  key_sha256 text not null check (key_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

revoke all on private.server_keys from public, anon, authenticated;

create function private.server_key_matches(p_name text, p_key text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(char_length(p_key) between 32 and 200, false)
     and exists (
       select 1 from private.server_keys k
       where k.name = p_name and k.key_sha256 = encode(extensions.digest(p_key, 'sha256'), 'hex')
     );
$$;

revoke all on function private.server_key_matches(text, text) from public;

-- Whether a text holds a control character, an invisible one (zero width, soft hyphen, fillers) or one that changes the
-- direction of writing. Zero-width joiners, variation selectors and tags stay: emoji need them.
create function private.has_hidden_chars(p_text text) returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_text ~ '[\u0001-\u0009\u000B-\u001F\u007F-\u009F­؜ᅟᅠ᠎​‎‏ -‮⁠-⁤⁦-⁯ㅤ﻿ﾠ]',
    false
  );
$$;

-- The same, also counting line breaks: for text that is a single line.
create function private.has_hidden_chars_or_breaks(p_text text) returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.has_hidden_chars(p_text) or coalesce(p_text ~ '\n', false);
$$;

revoke all on function private.has_hidden_chars(text), private.has_hidden_chars_or_breaks(text) from public;
grant execute on function private.has_hidden_chars(text), private.has_hidden_chars_or_breaks(text) to anon, authenticated;

drop function public.submit_copyright_claim(text, text, text, text, text, text[], boolean, boolean, text, uuid, uuid);

create function public.submit_copyright_claim(
  p_claimant_name text,
  p_claimant_email text,
  p_claimant_org text,
  p_work_description text,
  p_original_url text,
  p_infringing_urls text[],
  p_statement_good_faith boolean,
  p_statement_accuracy boolean,
  p_signature text,
  p_game_id uuid,
  p_post_id uuid,
  p_server_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := btrim(coalesce(p_claimant_email, ''));
  v_link constant text := '^https?://[^[:space:]]+$';
begin
  if not private.server_key_matches('claims', p_server_key) then
    raise exception 'server_key_required' using errcode = '42501';
  end if;
  if p_game_id is null and p_post_id is null then
    raise exception 'claim_target_required';
  end if;
  if p_game_id is not null and not exists (select 1 from public.games g where g.id = p_game_id and g.status in ('published', 'hidden')) then
    raise exception 'claim_target_not_found';
  end if;
  if p_post_id is not null and not exists (select 1 from public.posts x where x.id = p_post_id and x.status in ('published', 'hidden')) then
    raise exception 'claim_target_not_found';
  end if;
  if p_infringing_urls is null
     or cardinality(p_infringing_urls) = 0
     or exists (select 1 from unnest(p_infringing_urls) u where char_length(u) > 500 or u !~ v_link) then
    raise exception 'invalid_urls';
  end if;
  if nullif(btrim(coalesce(p_original_url, '')), '') is not null and btrim(p_original_url) !~ v_link then
    raise exception 'invalid_urls';
  end if;
  if private.has_hidden_chars_or_breaks(p_claimant_name) or private.has_hidden_chars_or_breaks(p_claimant_org)
     or private.has_hidden_chars_or_breaks(p_signature) or private.has_hidden_chars(p_work_description) then
    raise exception 'invalid_text';
  end if;

  if (select count(*) from public.copyright_claims c where lower(c.claimant_email) = lower(v_email) and c.created_at > now() - interval '24 hours') >= 3
     or (select count(*) from public.copyright_claims c where c.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too_many_claims';
  end if;

  insert into public.copyright_claims (
    id, claimant_name, claimant_email, claimant_org, work_description, original_url, infringing_urls,
    statement_good_faith, statement_accuracy, signature, game_id, post_id
  ) values (
    v_id, btrim(coalesce(p_claimant_name, '')), v_email, nullif(btrim(coalesce(p_claimant_org, '')), ''), btrim(coalesce(p_work_description, '')),
    nullif(btrim(coalesce(p_original_url, '')), ''), p_infringing_urls,
    coalesce(p_statement_good_faith, false), coalesce(p_statement_accuracy, false), btrim(coalesce(p_signature, '')), p_game_id, p_post_id
  );
  return v_id;
end;
$$;

revoke all on function public.submit_copyright_claim(text, text, text, text, text, text[], boolean, boolean, text, uuid, uuid, text) from public;
grant execute on function public.submit_copyright_claim(text, text, text, text, text, text[], boolean, boolean, text, uuid, uuid, text) to anon, authenticated;

-- 5 ------------------------------------------------------------------------------------------
revoke select on public.game_versions from anon, authenticated;
grant select (id, game_id, number, label, changelog, status, error_code, error_params, declared_size_bytes, size_bytes,
              unpacked_bytes, file_count, entry_path, needs_isolation, created_at, uploaded_at, processed_at)
  on public.game_versions to anon, authenticated;

-- Where the owner's browser uploads the zip of a version that is still waiting for it (to sign a new upload address).
create function public.version_upload_target(p_version_id uuid)
returns table (quarantine_key text, declared_size_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.can_write() then
    raise exception 'account_restricted' using errcode = '42501';
  end if;
  return query
    select v.quarantine_key, v.declared_size_bytes
    from public.game_versions v
    join public.games g on g.id = v.game_id
    where v.id = p_version_id
      and v.status = 'uploading'
      and g.owner_id = (select auth.uid())
      and g.status in ('draft', 'published');
end;
$$;

revoke all on function public.version_upload_target(uuid) from public;
grant execute on function public.version_upload_target(uuid) to authenticated;

revoke select on public.featured_games from anon, authenticated;
grant select (week_start, game_id, quote, created_at) on public.featured_games to anon, authenticated;

-- 6 ------------------------------------------------------------------------------------------
alter policy featured_games_select on public.featured_games
  using (week_start <= date_trunc('week', current_date)::date or private.is_admin());

-- 7 ------------------------------------------------------------------------------------------
-- Reserved: the exact names of private.reserved_usernames(), any name that contains the site's name (old or new), and any name
-- with a part (split by «.» and «_») that means the team.
create function private.is_reserved_username(p_username text) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_username = any (private.reserved_usernames())
      or p_username ~ '(tradfal|trafal)'
      or exists (
        select 1
        from regexp_split_to_table(p_username, '[._]') as part
        where part = any (array['admin', 'administrator', 'administrador', 'moderator', 'moderador', 'mod', 'soporte', 'support', 'staff', 'equipo', 'team'])
      );
$$;

revoke all on function private.is_reserved_username(text) from public;

create or replace function public.username_available(p_username text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_valid_username(lower(btrim(p_username)))
     and not private.is_reserved_username(lower(btrim(p_username)))
     and not exists (select 1 from public.profiles where username = lower(btrim(p_username)));
$$;

create or replace function public.complete_onboarding(
  p_username text,
  p_display_name text,
  p_terms_version text,
  p_accept_terms boolean,
  p_age_confirmed boolean,
  p_locale text default 'es'
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_name text := btrim(coalesce(p_display_name, ''));
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'already_onboarded';
  end if;
  if not coalesce(p_age_confirmed, false) then
    raise exception 'age_confirmation_required';
  end if;
  if not coalesce(p_accept_terms, false) then
    raise exception 'terms_required';
  end if;
  if not private.is_valid_username(v_username) then
    raise exception 'invalid_username';
  end if;
  if private.is_reserved_username(v_username) then
    raise exception 'reserved_username';
  end if;
  if char_length(v_name) not between 1 and 50 or private.has_hidden_chars_or_breaks(v_name) then
    raise exception 'invalid_display_name';
  end if;
  if coalesce(char_length(p_terms_version), 0) not between 1 and 32 then
    raise exception 'invalid_terms_version';
  end if;

  begin
    insert into public.profiles (id, username, display_name)
    values (v_uid, v_username, v_name)
    returning * into v_profile;
  exception when unique_violation then
    raise exception 'username_taken';
  end;

  insert into public.profile_private (id, locale, terms_version, terms_accepted_at, age_confirmed_at)
  values (v_uid, case when p_locale in ('es', 'en') then p_locale else 'es' end, p_terms_version, now(), now());

  return v_profile;
end;
$$;

-- 8 ------------------------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_plain check (not private.has_hidden_chars_or_breaks(display_name)),
  add constraint profiles_city_plain check (not private.has_hidden_chars_or_breaks(city)),
  add constraint profiles_bio_plain check (not private.has_hidden_chars(bio));

alter table public.games
  add constraint games_title_plain check (not private.has_hidden_chars_or_breaks(title)),
  add constraint games_short_description_plain check (not private.has_hidden_chars_or_breaks(short_description)),
  add constraint games_tags_plain check (not private.has_hidden_chars_or_breaks(array_to_string(tags, ' '))),
  add constraint games_controls_plain check (not private.has_hidden_chars(controls));

alter table public.game_questions
  add constraint game_questions_plain check (not private.has_hidden_chars_or_breaks(question));

alter table public.game_versions
  add constraint game_versions_label_plain check (not private.has_hidden_chars_or_breaks(label)),
  add constraint game_versions_changelog_plain check (not private.has_hidden_chars(changelog));

alter table public.posts
  add constraint posts_body_plain check (not private.has_hidden_chars(body)),
  add constraint posts_highlight_plain check (not private.has_hidden_chars_or_breaks(highlight));

alter table public.comments
  add constraint comments_body_plain check (not private.has_hidden_chars(body));
