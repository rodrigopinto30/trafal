-- ---------------------------------------------------------------------------------------------
-- Accepting the terms again.
--
-- When the legal texts change, the version the app asks for (TERMS_VERSION) moves ahead of the one each account accepted. The
-- person records that they accepted the new one with accept_terms(): it writes only their own row, and only these fields (the
-- table grants them nothing else), together with the moment and the age confirmation, which is asked again with it.
--
-- It works for suspended accounts too: nobody should be unable to accept, and accepting gives no new permission.
-- ---------------------------------------------------------------------------------------------

create function public.accept_terms(p_terms_version text, p_age_confirmed boolean) returns void
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
  if coalesce(char_length(p_terms_version), 0) not between 1 and 32 then
    raise exception 'invalid_terms_version';
  end if;
  if p_age_confirmed is not true then
    raise exception 'age_confirmation_required';
  end if;

  update public.profile_private
     set terms_version = p_terms_version, terms_accepted_at = now(), age_confirmed_at = now()
   where id = v_user;
  if not found then
    raise exception 'profile_required';
  end if;
end;
$$;

revoke all on function public.accept_terms(text, boolean) from public;
grant execute on function public.accept_terms(text, boolean) to authenticated;
