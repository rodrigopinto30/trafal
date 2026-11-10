-- ---------------------------------------------------------------------------------------------
-- Copyright claims.
--
-- Anyone, with or without an account, can send a claim through submit_copyright_claim (the table has no INSERT grant for anybody).
-- Only admins read them, and they handle them through two audited functions, like the reports:
--
--   take_claim(claim)                    open -> reviewing
--   resolve_claim(claim, outcome, note)  open/reviewing -> dismissed | actioned | actioned by hiding what was claimed
--
-- Hiding goes through the same private.apply_moderation as any other moderation (reversible, with the reason, the author is told,
-- logged); the claim keeps pointing at the game or update, whatever happens to it afterwards.
--
-- A claim must point at something that exists on the site (a game or an update, found by the server from the links the person
-- sent), so it can be acted on. To keep the form from being used to flood the admins, one email can send 3 claims a day and the
-- whole site accepts 60 an hour (a captcha is added in front of the form separately).
-- ---------------------------------------------------------------------------------------------

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
  p_post_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := btrim(coalesce(p_claimant_email, ''));
begin
  if p_game_id is null and p_post_id is null then
    raise exception 'claim_target_required';
  end if;
  if p_game_id is not null and not exists (select 1 from public.games g where g.id = p_game_id and g.status in ('published', 'hidden')) then
    raise exception 'claim_target_not_found';
  end if;
  if p_post_id is not null and not exists (select 1 from public.posts x where x.id = p_post_id and x.status in ('published', 'hidden')) then
    raise exception 'claim_target_not_found';
  end if;
  if p_infringing_urls is null or exists (select 1 from unnest(p_infringing_urls) u where btrim(u) = '' or char_length(u) > 500) then
    raise exception 'invalid_urls';
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

create function public.take_claim(p_claim_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_status text;
begin
  select c.status into v_status from public.copyright_claims c where c.id = p_claim_id for update;
  if v_status is null then
    raise exception 'claim_not_found';
  end if;
  if v_status <> 'open' then
    raise exception 'claim_not_open';
  end if;
  update public.copyright_claims set status = 'reviewing' where id = p_claim_id;
  perform private.log_moderation(v_admin, 'take_claim', 'claim', p_claim_id, null);
end;
$$;

create function public.resolve_claim(p_claim_id uuid, p_outcome text, p_note text default null) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_claim public.copyright_claims;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_hidden boolean := false;
begin
  if p_outcome not in ('dismissed', 'actioned', 'hide_content') then
    raise exception 'invalid_outcome';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'note_too_long';
  end if;

  select * into v_claim from public.copyright_claims c where c.id = p_claim_id for update;
  if not found then
    raise exception 'claim_not_found';
  end if;
  if v_claim.status not in ('open', 'reviewing') then
    raise exception 'claim_already_resolved';
  end if;

  if p_outcome = 'hide_content' then
    if v_note is null then
      raise exception 'reason_required';
    end if;
    if v_claim.game_id is not null and exists (select 1 from public.games g where g.id = v_claim.game_id and g.status = 'published') then
      perform private.apply_moderation(v_admin, 'game', v_claim.game_id, 'hide', v_note);
      v_hidden := true;
    end if;
    if v_claim.post_id is not null and exists (select 1 from public.posts x where x.id = v_claim.post_id and x.status = 'published') then
      perform private.apply_moderation(v_admin, 'post', v_claim.post_id, 'hide', v_note);
      v_hidden := true;
    end if;
    if not v_hidden then
      raise exception 'nothing_to_hide';
    end if;
  end if;

  update public.copyright_claims
     set status = case when p_outcome = 'dismissed' then 'dismissed' else 'actioned' end,
         handled_by = v_admin,
         handled_at = now(),
         resolution_note = v_note
   where id = p_claim_id;
  perform private.log_moderation(v_admin, case when p_outcome = 'dismissed' then 'dismiss_claim' else 'action_claim' end, 'claim', p_claim_id, v_note);
end;
$$;

revoke all on function public.submit_copyright_claim(text, text, text, text, text, text[], boolean, boolean, text, uuid, uuid) from public;
revoke all on function public.take_claim(uuid) from public;
revoke all on function public.resolve_claim(uuid, text, text) from public;
grant execute on function public.submit_copyright_claim(text, text, text, text, text, text[], boolean, boolean, text, uuid, uuid) to anon, authenticated;
grant execute on function public.take_claim(uuid) to authenticated;
grant execute on function public.resolve_claim(uuid, text, text) to authenticated;
