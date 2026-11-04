-- Trafal · 06 · Realtime
-- Estado de las subidas en vivo (game_versions) y campanita de notificaciones.
-- Realtime respeta RLS: cada cliente solo recibe las filas que sus policies le dejan ver.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.game_versions, public.notifications;
  end if;
end;
$$;
