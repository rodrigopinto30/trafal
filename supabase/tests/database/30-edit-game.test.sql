-- Editing a game after it was uploaded: edit_game(...) changes the details, cover, screenshots and questions in one transaction.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');

create function pg_temp.game_id(p_title text) returns uuid language sql as $$ select id from public.games where title = p_title $$;
create function pg_temp.shot(p_game uuid, p_token text) returns text language sql as $$
  select 'screenshots/' || p_game::text || '/' || p_token || '.png'
$$;

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
insert into public.games (owner_id, title, short_description, genre_id, tags, controls)
  values ('a0000000-0000-0000-0000-000000000001', 'Old title', 'Old text', 'platformer', array['retro'], 'Old controls');
insert into public.games (owner_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Other game');
insert into public.game_screenshots (game_id, path, position) values
  (pg_temp.game_id('Old title'), pg_temp.shot(pg_temp.game_id('Old title'), '11111111111111111111111111111111'), 1),
  (pg_temp.game_id('Old title'), pg_temp.shot(pg_temp.game_id('Old title'), '22222222222222222222222222222222'), 2);
insert into public.game_questions (game_id, position, question) values
  (pg_temp.game_id('Old title'), 1, 'Does the jump feel good?'),
  (pg_temp.game_id('Old title'), 2, 'What would you change?'),
  (pg_temp.game_id('Old title'), 3, 'Was it too hard?');
select tests.clear_authentication();

create temp table ids as
  select (select id from public.games where title = 'Old title') as main, (select id from public.games where title = 'Other game') as other;
create temp table first_question as
  select id from public.game_questions where game_id = (select main from ids) and position = 1;
grant select on ids, first_question to authenticated;

-- ------------------------------------------------------------------ the owner edits everything
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$
  select public.edit_game(
    (select main from ids), 'New title', 'New text', 'puzzle', array['relax', 'pixel'], 'New controls',
    'covers/a0000000-0000-0000-0000-000000000001/33333333333333333333333333333333.png',
    jsonb_build_array(
      jsonb_build_object('path', pg_temp.shot((select main from ids), '22222222222222222222222222222222'), 'alt_text', 'kept'),
      jsonb_build_object('path', pg_temp.shot((select main from ids), '44444444444444444444444444444444'))
    ),
    array['Does the jump feel good now?', 'What would you change?']
  )
$$, 'the owner edits the details, the cover, the screenshots and the questions');
select is((select title from public.games where id = (select main from ids)), 'New title', 'the title changed');
select is((select short_description from public.games where title = 'New title'), 'New text', 'so did the short description');
select is((select genre_id from public.games where title = 'New title'), 'puzzle', 'and the genre');
select is((select tags from public.games where title = 'New title'), array['pixel', 'relax'], 'the tags are cleaned by the same trigger as on creation');
select is((select controls from public.games where title = 'New title'), 'New controls', 'and the controls');
select is((select cover_path from public.games where title = 'New title'), 'covers/a0000000-0000-0000-0000-000000000001/33333333333333333333333333333333.png', 'the cover changed');
select ok((select search_doc @@ to_tsquery('simple', 'relax') from public.games where title = 'New title'), 'the search index follows the new tags');
select ok((select search_doc @@ to_tsquery('simple', 'old') from public.games where title = 'New title') is not true, 'and forgets the old title');
select results_eq(
  $$ select position::integer, right(path, 36), alt_text from public.game_screenshots where game_id = (select main from ids) order by position $$,
  $$ values (1, '22222222222222222222222222222222.png', 'kept'), (2, '44444444444444444444444444444444.png', '') $$,
  'the screenshots are the ones sent, in that order, one of them kept'
);
select results_eq(
  $$ select position::integer, question from public.game_questions where game_id = (select main from ids) order by position $$,
  $$ values (1, 'Does the jump feel good now?'), (2, 'What would you change?') $$,
  'the questions follow the new list and the one at the end is gone'
);
select is((select id from public.game_questions where game_id = (select main from ids) and position = 1), (select id from first_question), 'a reworded question keeps its id, so its answers stay attached');

select lives_ok($$
  select public.edit_game((select main from ids), 'New title', '', null, '{}', '', null, '[]'::jsonb, '{}')
$$, 'everything optional can be emptied');
select is((select cover_path from public.games where title = 'New title'), null, 'the cover is gone');
select is((select count(*) from public.game_screenshots where game_id = (select main from ids)), 0::bigint, 'no screenshots left');
select is((select count(*) from public.game_questions where game_id = (select main from ids)), 0::bigint, 'no questions left');

-- ------------------------------------------------------------------ all or nothing
select throws_ok($$
  select public.edit_game(
    (select main from ids), 'Half done', 'x', 'platformer', '{}', '', null,
    jsonb_build_array(jsonb_build_object('path', pg_temp.shot((select other from ids), '55555555555555555555555555555555'))),
    '{}'
  )
$$, '23514', null, 'a screenshot that lives in another game''s folder is rejected');
select is((select title from public.games where id = (select main from ids)), 'New title', 'and the new title was rolled back with it');
select throws_ok($$
  select public.edit_game((select main from ids), 'Too many', '', null, '{}', '', null, '[]'::jsonb, array['aaa', 'bbb', 'ccc', 'ddd'])
$$, 'P0001', 'too_many_questions', 'more than three questions are rejected');
select throws_ok($$
  select public.edit_game((select main from ids), 'Bad cover', '', null, '{}', '', 'covers/b0000000-0000-0000-0000-000000000002/33333333333333333333333333333333.png', '[]'::jsonb, '{}')
$$, '23514', null, 'a cover that lives in someone else''s folder is rejected');
select throws_ok($$
  select public.edit_game((select main from ids), 'Bad shape', '', null, '{}', '', null, '{}'::jsonb, '{}')
$$, 'P0001', 'invalid_screenshots', 'the screenshots must be a list');
select throws_ok($$
  select public.edit_game((select main from ids), '', '', null, '{}', '', null, '[]'::jsonb, '{}')
$$, '23514', null, 'the table constraints still apply: a title cannot be empty');

-- ------------------------------------------------------------------ who cannot edit
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok($$
  select public.edit_game((select main from ids), 'Stolen', '', null, '{}', '', null, '[]'::jsonb, '{}')
$$, 'P0001', 'game_not_found', 'someone else cannot edit a game that is not theirs');
select tests.authenticate_as_anon();
select throws_ok($$
  select public.edit_game((select main from ids), 'Stolen', '', null, '{}', '', null, '[]'::jsonb, '{}')
$$, '42501', null, 'visitors cannot either');

select tests.clear_authentication();
select is((select title from public.games where id = (select main from ids)), 'New title', 'the game is untouched');

-- ------------------------------------------------------------------ moderated games stay as they were
update public.games set status = 'hidden' where title = 'New title';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$
  select public.edit_game((select main from ids), 'Rewritten', '', null, '{}', '', null, '[]'::jsonb, '{}')
$$, 'P0001', 'game_not_found', 'the owner cannot edit a game that moderation hid');
select tests.clear_authentication();
select is((select title from public.games where id = (select main from ids)), 'New title', 'and nothing changed');

select * from finish();
rollback;
