-- Naming admins: only an active admin, only through set_account_role, never on oneself (so there is always one admin left), never a
-- suspended account, with a reason the person reads, and every change in the append-only log. Nobody writes the role directly.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ae', 'admino', 'admin');

create function pg_temp.role_of(p_user uuid) returns text language sql as $$ select role from public.profile_private where id = p_user $$;
create function pg_temp.last_log() returns text language sql as $$
  select action || '|' || admin_username || '|' || target_type || '|' || target_id::text || '|' || coalesce(reason, 'null') from public.moderation_log order by id desc limit 1
$$;
create function pg_temp.logged() returns bigint language sql as $$ select count(*) from public.moderation_log where created_at = now() $$;

-- ------------------------------------------------------------------ who may do it
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', 'admin', 'x') $$, '42501', 'not_admin', 'an ordinary account cannot name admins');
select throws_ok($$ select public.set_account_role('a0000000-0000-0000-0000-000000000001', 'admin', 'x') $$, '42501', 'not_admin', 'not even itself');
select throws_ok($$ update public.profile_private set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001' $$, '42501', null, 'nor by writing the role directly');
select tests.authenticate_as_anon();
select throws_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', 'admin', 'x') $$, '42501', null, 'a visitor neither');

-- ------------------------------------------------------------------ naming an admin
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ update public.profile_private set role = 'admin' where id = 'b0000000-0000-0000-0000-000000000002' $$, '42501', null, 'an admin does not write the role directly either');
select lives_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', 'admin', '  Joins the moderation team  ') $$, 'the admin names bruno');
select is(pg_temp.role_of('b0000000-0000-0000-0000-000000000002'), 'admin', 'bruno is an admin');
select is(pg_temp.last_log(), 'grant_admin|admina|profile|b0000000-0000-0000-0000-000000000002|Joins the moderation team', 'the log says who, what, whom and why');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(
  (select data ->> 'action' || '|' || (data ->> 'target_type') || '|' || (data ->> 'reason') from public.notifications where type = 'moderation'),
  'admin_granted|profile|Joins the moderation team',
  'bruno is told, with the reason'
);
select is((select actor_id from public.notifications where type = 'moderation'), null, 'without saying which admin acted');
select is(private.is_admin(), true, 'and from now on the database treats him as an admin');

-- ------------------------------------------------------------------ what it refuses (and nothing is logged)
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.suspend_account('a0000000-0000-0000-0000-000000000001', 'Spam', null) $$, 'ana is suspended');
select is(pg_temp.logged(), 2::bigint, 'two lines so far');
select throws_ok($$ select public.set_account_role('d0000000-0000-0000-0000-0000000000ad', 'user', 'Leaving') $$, 'P0001', 'cannot_change_own_role', 'nobody changes their own role');
select throws_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', 'admin', 'Again') $$, 'P0001', 'role_unchanged', 'naming someone who already is one');
select throws_ok($$ select public.set_account_role('a0000000-0000-0000-0000-000000000001', 'admin', 'Why not') $$, 'P0001', 'cannot_promote_suspended', 'a suspended account cannot become an admin');
select throws_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', 'owner', 'x') $$, 'P0001', 'invalid_role', 'only the two roles exist');
select throws_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', null, 'x') $$, 'P0001', 'invalid_role', 'and a role is needed');
select throws_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', 'user', '   ') $$, 'P0001', 'reason_required', 'a reason is needed');
select throws_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', 'user', repeat('x', 501)) $$, 'P0001', 'reason_required', 'up to 500 characters');
select throws_ok($$ select public.set_account_role(gen_random_uuid(), 'admin', 'x') $$, 'P0001', 'account_not_found', 'only existing accounts');
select is(pg_temp.logged(), 2::bigint, 'nothing refused reaches the log');
select is(pg_temp.role_of('a0000000-0000-0000-0000-000000000001'), 'user', 'and ana is still an ordinary account');

-- ------------------------------------------------------------------ taking the role away
select lives_ok($$ select public.set_account_role('b0000000-0000-0000-0000-000000000002', 'user', 'Left the team') $$, 'the admin takes the role away from bruno');
select is(pg_temp.role_of('b0000000-0000-0000-0000-000000000002'), 'user', 'bruno is an ordinary account again');
select is(pg_temp.last_log(), 'revoke_admin|admina|profile|b0000000-0000-0000-0000-000000000002|Left the team', 'logged as well');

select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select is(
  (select data ->> 'action' || '|' || (data ->> 'reason') from public.notifications where type = 'moderation' order by created_at desc, data ->> 'action' desc limit 1),
  'admin_revoked|Left the team',
  'bruno is told'
);
select is(private.is_admin(), false, 'the database no longer treats him as an admin');
select throws_ok($$ select public.set_account_role('a0000000-0000-0000-0000-000000000001', 'admin', 'x') $$, '42501', 'not_admin', 'so he cannot name anyone');

-- ------------------------------------------------------------------ there is always an admin left
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ae');
select lives_ok($$ select public.set_account_role('d0000000-0000-0000-0000-0000000000ad', 'user', 'Rotation') $$, 'one admin takes the role away from the other');
select throws_ok($$ select public.set_account_role('d0000000-0000-0000-0000-0000000000ae', 'user', 'Leaving') $$, 'P0001', 'cannot_change_own_role', 'the last one cannot leave the team without admins');
select is((select count(*) from public.profile_private where role = 'admin'), 1::bigint, 'one admin is left');
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.set_account_role('d0000000-0000-0000-0000-0000000000ae', 'user', 'Revenge') $$, '42501', 'not_admin', 'and the former admin cannot take it back');

select * from finish();
rollback;
