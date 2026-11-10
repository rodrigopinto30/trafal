-- Suspending and reinstating accounts: only an active admin, only through the audited functions, a reason the person reads,
-- nothing on admins or on oneself, every action in the append-only log, and what a suspended account can no longer do.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ae', 'admino', 'admin');

insert into public.posts (id, author_id, kind, body) values
  ('55555555-5555-5555-5555-555555555560', 'b0000000-0000-0000-0000-000000000002', 'avance', 'An update of bruno');

create function pg_temp.last_log() returns text language sql as $$
  select action || '|' || admin_username || '|' || target_type || '|' || target_id::text || '|' || coalesce(reason, 'null') from public.moderation_log order by id desc limit 1
$$;
create function pg_temp.logged() returns bigint language sql as $$ select count(*) from public.moderation_log where created_at = now() $$;

-- ------------------------------------------------------------------ who may do it
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.suspend_account('b0000000-0000-0000-0000-000000000002', 'x') $$, '42501', 'not_admin', 'an ordinary account cannot suspend');
select throws_ok($$ select public.lift_suspension('b0000000-0000-0000-0000-000000000002', 'x') $$, '42501', 'not_admin', 'nor lift');
select tests.authenticate_as_anon();
select throws_ok($$ select public.suspend_account('b0000000-0000-0000-0000-000000000002', 'x') $$, '42501', null, 'a visitor neither');

-- ------------------------------------------------------------------ suspending
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.suspend_account('a0000000-0000-0000-0000-000000000001', '  Repeated insults  ', now() + interval '7 days') $$, 'the admin suspends an account for a week');
select is((select status from public.profile_private where id = 'a0000000-0000-0000-0000-000000000001'), 'suspended', 'it is suspended');
select is((select suspension_reason from public.profile_private where id = 'a0000000-0000-0000-0000-000000000001'), 'Repeated insults', 'with the reason, trimmed');
select ok((select suspended_until from public.profile_private where id = 'a0000000-0000-0000-0000-000000000001') > now() + interval '6 days', 'and the end date');
select ok(pg_temp.last_log() like 'suspend_account|admina|profile|a0000000-0000-0000-0000-000000000001|Repeated insults (until % UTC)', 'the log says who, what, whom, why and until when');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select data ->> 'action' || '|' || (data ->> 'target_type') || '|' || (data ->> 'reason') from public.notifications where type = 'moderation'), 'suspend|profile|Repeated insults', 'the person is told, with the reason');
select ok((select data ->> 'until' from public.notifications where type = 'moderation') is not null, 'and until when');
select is((select actor_id from public.notifications where type = 'moderation'), null, 'without saying which admin acted');
select is(private.can_write(), false, 'a suspended account cannot write');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason) values ('a0000000-0000-0000-0000-000000000001', 'post', '55555555-5555-5555-5555-555555555560', 'spam') $$, '42501', null, 'so it cannot report');
select throws_ok($$ insert into public.comments (author_id, post_id, body) values ('a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555560', 'hi') $$, '42501', null, 'nor comment');
select is((select status from public.profile_private where id = 'a0000000-0000-0000-0000-000000000001'), 'suspended', 'but it can read its own state (to be told what happened)');
select throws_ok($$ update public.profile_private set status = 'active', suspended_until = null where id = 'a0000000-0000-0000-0000-000000000001' $$, '42501', null, 'and it cannot lift the suspension itself');

-- ------------------------------------------------------------------ what it refuses
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.suspend_account('a0000000-0000-0000-0000-000000000001', 'again') $$, 'P0001', 'already_suspended', 'a suspended account is not suspended again');
select throws_ok($$ select public.suspend_account('b0000000-0000-0000-0000-000000000002', '   ') $$, 'P0001', 'reason_required', 'a reason is required');
select throws_ok($$ select public.suspend_account('b0000000-0000-0000-0000-000000000002', repeat('x', 501)) $$, 'P0001', 'reason_required', 'and not a novel');
select throws_ok($$ select public.suspend_account('b0000000-0000-0000-0000-000000000002', 'x', now() - interval '1 minute') $$, 'P0001', 'invalid_until', 'the end date must be in the future');
select throws_ok($$ select public.suspend_account('d0000000-0000-0000-0000-0000000000ad', 'x') $$, 'P0001', 'cannot_suspend_self', 'an admin cannot suspend themselves');
select throws_ok($$ select public.suspend_account('d0000000-0000-0000-0000-0000000000ae', 'x') $$, 'P0001', 'cannot_suspend_admin', 'nor another admin');
select throws_ok($$ select public.suspend_account(gen_random_uuid(), 'x') $$, 'P0001', 'account_not_found', 'an account that does not exist is not found');
select throws_ok($$ select public.lift_suspension('b0000000-0000-0000-0000-000000000002', 'x') $$, 'P0001', 'not_suspended', 'an account that is not suspended cannot be lifted');
select throws_ok($$ select public.lift_suspension('a0000000-0000-0000-0000-000000000001', ' ') $$, 'P0001', 'reason_required', 'lifting needs a reason too');
select is(pg_temp.logged(), 1::bigint, 'and nothing refused leaves a line in the log');

-- ------------------------------------------------------------------ lifting
select lives_ok($$ select public.lift_suspension('a0000000-0000-0000-0000-000000000001', 'It was a misunderstanding') $$, 'the admin lifts it');
select is((select status || '|' || coalesce(suspended_until::text, 'null') || '|' || coalesce(suspension_reason, 'null') from public.profile_private where id = 'a0000000-0000-0000-0000-000000000001'), 'active|null|null', 'the account is active and the state is cleared');
select is(pg_temp.last_log(), 'lift_suspension|admina|profile|a0000000-0000-0000-0000-000000000001|It was a misunderstanding', 'the lifting is logged');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(private.can_write(), true, 'and the person writes again');
select is((select count(*) from public.notifications where type = 'moderation' and data ->> 'action' = 'lift'), 1::bigint, 'who is told too');

-- ------------------------------------------------------------------ indefinite and expired suspensions
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.suspend_account('b0000000-0000-0000-0000-000000000002', 'Until further notice') $$, 'a suspension may have no end date');
select ok(pg_temp.last_log() like '%(no end date)', 'which the log says');
select is((select suspended_until from public.profile_private where id = 'b0000000-0000-0000-0000-000000000002'), null, 'and none is stored');
select throws_ok($$ select public.suspend_account('b0000000-0000-0000-0000-000000000002', 'again') $$, 'P0001', 'already_suspended', 'it counts as suspended');
select lives_ok($$ select public.lift_suspension('b0000000-0000-0000-0000-000000000002', 'Enough') $$, 'and is lifted by an admin');

select tests.clear_authentication();
update public.profile_private set status = 'suspended', suspended_until = now() - interval '1 minute', suspension_reason = 'old' where id = 'b0000000-0000-0000-0000-000000000002';
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.lift_suspension('b0000000-0000-0000-0000-000000000002', 'x') $$, 'P0001', 'not_suspended', 'a suspension whose date has passed is over: nothing to lift');
select lives_ok($$ select public.suspend_account('b0000000-0000-0000-0000-000000000002', 'New problem', now() + interval '1 day') $$, 'and the account can be suspended again');

-- ------------------------------------------------------------------ a suspended admin loses the powers
select tests.clear_authentication();
update public.profile_private set status = 'suspended', suspended_until = now() + interval '1 day' where id = 'd0000000-0000-0000-0000-0000000000ae';
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ae');
select throws_ok($$ select public.suspend_account('a0000000-0000-0000-0000-000000000001', 'x') $$, '42501', 'not_admin', 'an admin whose account is suspended cannot suspend anyone');

select * from finish();
rollback;
