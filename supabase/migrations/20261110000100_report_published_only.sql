-- Only published content can be reported: a report keeps a copy of the content for the admins, and the reporter reads their own
-- reports, so reporting something hidden, removed or a draft (whose id the person happened to know) would hand them its text.
create or replace function private.reports_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.detail := btrim(new.detail);
  new.snapshot := case new.target_type
    when 'game' then (
      select jsonb_build_object('title', g.title, 'short_description', g.short_description, 'owner', p.username)
      from public.games g join public.profiles p on p.id = g.owner_id
      where g.id = new.target_id and g.status = 'published')
    when 'post' then (
      select jsonb_build_object('kind', x.kind, 'body', x.body, 'author', p.username)
      from public.posts x join public.profiles p on p.id = x.author_id
      where x.id = new.target_id and x.status = 'published')
    when 'comment' then (
      select jsonb_build_object('body', c.body, 'author', p.username)
      from public.comments c join public.profiles p on p.id = c.author_id
      where c.id = new.target_id and c.status = 'published')
    when 'profile' then (
      select jsonb_build_object('username', p.username, 'display_name', p.display_name, 'bio', p.bio)
      from public.profiles p where p.id = new.target_id)
  end;
  if new.snapshot is null then
    raise exception 'report_target_not_found';
  end if;
  return new;
end;
$$;
