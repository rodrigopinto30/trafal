-- Two games cannot share a name (ignoring case); a game removed by moderation frees its name.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Space Cats');
insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Rocket Dogs');
select tests.clear_authentication();

create temp table ids as
  select (select id from public.games where title = 'Space Cats') as cats, (select id from public.games where title = 'Rocket Dogs') as dogs;
grant select on ids to authenticated;

-- ------------------------------------------------------------------ creating
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$
  insert into public.games (owner_id, title) values ('b0000000-0000-0000-0000-000000000002', 'Space Cats')
$$, '23505', null, 'someone else cannot take a name that is in use');
select throws_ok($$
  insert into public.games (owner_id, title) values ('b0000000-0000-0000-0000-000000000002', 'sPACE cATS')
$$, '23505', null, 'upper and lower case do not make a different name');
select throws_ok($$
  insert into public.games (owner_id, title) values ('b0000000-0000-0000-0000-000000000002', '  space cats ')
$$, '23505', null, 'nor do spaces around it');
select lives_ok($$
  insert into public.games (owner_id, title) values ('b0000000-0000-0000-0000-000000000002', 'Space Cáts')
$$, 'accents do make a different name');
select lives_ok($$
  insert into public.games (owner_id, title) values ('b0000000-0000-0000-0000-000000000002', 'Bruno draft')
$$, 'a draft takes its name like any other game');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$
  insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'BRUNO DRAFT')
$$, '23505', null, 'the name of someone else''s draft is taken too, even if the draft cannot be seen');
select throws_ok($$
  insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'space cats')
$$, '23505', null, 'the owner cannot repeat a name of their own either');

-- ------------------------------------------------------------------ editing
select lives_ok($$
  select public.edit_game((select cats from ids), 'SPACE CATS', '', null, '{}', '', null, '[]'::jsonb, '{}')
$$, 'a game can change the case of its own name');
select is((select title from public.games where id = (select cats from ids)), 'SPACE CATS', 'and keeps the new spelling');
select throws_ok($$
  select public.edit_game((select dogs from ids), 'space cats', '', null, '{}', '', null, '[]'::jsonb, '{}')
$$, '23505', null, 'editing cannot take a name that is in use');
select is((select title from public.games where id = (select dogs from ids)), 'Rocket Dogs', 'and leaves the game as it was');
select tests.clear_authentication();

-- ------------------------------------------------------------------ moderation
update public.games set status = 'hidden' where id = (select cats from ids);
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$
  insert into public.games (owner_id, title) values ('b0000000-0000-0000-0000-000000000002', 'Space Cats')
$$, '23505', null, 'a hidden game keeps its name (it can be restored)');
select tests.clear_authentication();

update public.games set status = 'removed' where id = (select cats from ids);
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select lives_ok($$
  insert into public.games (owner_id, title) values ('b0000000-0000-0000-0000-000000000002', 'Space Cats')
$$, 'a game removed by moderation frees its name');
select tests.clear_authentication();

select * from finish();
rollback;
