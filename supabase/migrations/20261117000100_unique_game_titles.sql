-- Two games cannot share a name, ignoring upper and lower case ("Zona cero" and "zona cero" are the same name); accents do
-- count. Drafts, published and hidden games hold their name (a hidden game can be restored); a game removed by moderation
-- is final and frees it.
--
-- Games that already share a name keep the oldest one as it is; each newer one gets " (2)", " (3)"... so the rule can apply.

do $$
declare
  v_game record;
  v_number integer;
  v_suffix text;
  v_title text;
begin
  for v_game in
    select ranked.id, btrim(ranked.title) as title
      from (
        select g.id, g.title,
               row_number() over (partition by lower(btrim(g.title)) order by g.created_at, g.id) as position
          from public.games g
         where g.status <> 'removed'
      ) ranked
     where ranked.position > 1
     order by lower(btrim(ranked.title)), ranked.position
  loop
    v_number := 2;
    loop
      v_suffix := ' (' || v_number || ')';
      v_title := left(v_game.title, 80 - char_length(v_suffix)) || v_suffix;
      exit when not exists (
        select 1 from public.games g where g.status <> 'removed' and lower(btrim(g.title)) = lower(v_title)
      );
      v_number := v_number + 1;
    end loop;
    update public.games set title = v_title where id = v_game.id;
  end loop;
end
$$;

create unique index games_title_unique on public.games (lower(btrim(title))) where status <> 'removed';
