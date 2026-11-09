-- ---------------------------------------------------------------------------------------------
-- The check that a featured game is a published first game only has to run when the pick points at a game: on insert, or when
-- an update changes game_id. Any other update (for example the one the database does by itself when the admin who chose it
-- deletes their account, setting chosen_by to null, or when the game is being deleted in the same statement) must not re-check
-- the game: it would make deleting an account fail for a reason that has nothing to do with what is being changed.
-- ---------------------------------------------------------------------------------------------

create or replace function private.featured_games_before_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.game_id is not distinct from old.game_id then
    return new;
  end if;
  if not exists (
    select 1 from public.games g
    where g.id = new.game_id and g.is_first_game and g.status = 'published'
  ) then
    raise exception 'featured_requires_published_first_game';
  end if;
  return new;
end;
$$;
