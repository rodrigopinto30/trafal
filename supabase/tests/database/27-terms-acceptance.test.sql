-- Accepting the terms again: only a signed-in person with a profile, only their own row, the age is confirmed with it, and nothing
-- else about the account (role, suspension) can move through it.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');

update public.profile_private set terms_version = '2026-01-01', terms_accepted_at = '2026-01-01', age_confirmed_at = '2026-01-01'
where id in ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');

select tests.authenticate_as_anon();
select throws_ok($$ select public.accept_terms('2026-11-10', true) $$, '42501', null, 'a visitor cannot accept');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.accept_terms('2026-11-10', false) $$, 'P0001', 'age_confirmation_required', 'the age has to be confirmed with it');
select throws_ok($$ select public.accept_terms('2026-11-10', null) $$, 'P0001', 'age_confirmation_required', 'a missing confirmation is not a yes');
select throws_ok($$ select public.accept_terms('', true) $$, 'P0001', 'invalid_terms_version', 'the version cannot be empty');
select throws_ok($$ select public.accept_terms(repeat('x', 33), true) $$, 'P0001', 'invalid_terms_version', 'nor longer than the column allows');
select is((select terms_version from public.profile_private where id = 'a0000000-0000-0000-0000-000000000001'), '2026-01-01', 'a refused attempt changes nothing');

select lives_ok($$ select public.accept_terms('2026-11-10', true) $$, 'ana accepts the current version');
select is((select terms_version from public.profile_private where id = 'a0000000-0000-0000-0000-000000000001'), '2026-11-10', 'her version is recorded');
select ok((select terms_accepted_at > '2026-06-01' and age_confirmed_at > '2026-06-01' from public.profile_private where id = 'a0000000-0000-0000-0000-000000000001'), 'with the moment of the acceptance and of the age confirmation');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is((select terms_version from public.profile_private where id = 'b0000000-0000-0000-0000-000000000002'), '2026-01-01', 'bruno still has his own version: accepting is personal');

select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.accept_terms('2026-11-10', true) $$, 'an admin accepts like anyone');
select is((select role from public.profile_private where id = 'd0000000-0000-0000-0000-0000000000ad'), 'admin', 'and stays an admin');

select tests.clear_authentication();
update public.profile_private set status = 'suspended', suspended_until = now() + interval '1 day' where id = 'b0000000-0000-0000-0000-000000000002';
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.accept_terms('2026-11-10', true) $$, 'a suspended person can accept too');
select is((select status from public.profile_private where id = 'b0000000-0000-0000-0000-000000000002'), 'suspended', 'and it does not lift the suspension');

select tests.clear_authentication();
insert into auth.users (id, instance_id, aud, role, email) values ('e0000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noprofile@example.com');
select tests.authenticate_as('e0000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select public.accept_terms('2026-11-10', true) $$, 'P0001', 'profile_required', 'without a profile there is nothing to update (the onboarding records it)');

select * from finish();
rollback;
