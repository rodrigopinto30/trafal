-- Invariantes globales del esquema: si alguien agrega una tabla o función y se olvida de la
-- seguridad, este archivo falla antes de que llegue a producción.
begin;
select no_plan();

-- 1) RLS activado en TODAS las tablas de `public`.
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '',
  'todas las tablas de public tienen RLS activado'
);

-- 2) Los visitantes (anon) no pueden escribir en ninguna tabla, ni a nivel tabla ni por columna.
select is(
  (select coalesce(string_agg(table_name || ':' || privilege_type, ', ' order by table_name), '')
     from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')),
  '',
  'anon no tiene privilegios de escritura a nivel tabla'
);
select is(
  (select coalesce(string_agg(table_name || '.' || column_name || ':' || privilege_type, ', ' order by table_name), '')
     from information_schema.column_privileges
    where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE')),
  '',
  'anon no tiene privilegios de escritura por columna'
);

-- 3) authenticated nunca tiene TRUNCATE/REFERENCES/TRIGGER, y INSERT/UPDATE solo POR COLUMNA
--    (un grant a nivel tabla permitiría escribir columnas protegidas como role o los contadores).
select is(
  (select coalesce(string_agg(table_name || ':' || privilege_type, ', ' order by table_name), '')
     from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')),
  '',
  'authenticated no tiene INSERT/UPDATE a nivel tabla: todo es por columna'
);

-- 4) Las columnas protegidas jamás son escribibles desde el cliente. Excepciones deliberadas:
--    el estado de un juego (borrador <-> publicado, validado por trigger) y marcar una
--    notificación como leída.
select is(
  (select coalesce(string_agg(table_name || '.' || column_name || ':' || privilege_type, ', ' order by table_name, column_name), '')
     from information_schema.column_privileges
    where grantee in ('authenticated', 'anon') and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE')
      and (
           column_name in ('role', 'status', 'suspended_until', 'is_helpful', 'active_version_id', 'public_id', 'search_doc', 'id')
        or column_name like '%\_count' escape '\'
        or column_name like '%\_by' escape '\'
        or column_name like '%\_at' escape '\'
      )
      and not (table_name = 'games' and column_name = 'status' and privilege_type = 'UPDATE')
      and not (table_name = 'notifications' and column_name = 'read_at' and privilege_type = 'UPDATE')
  ),
  '',
  'ninguna columna protegida (rol, estado, contadores, is_helpful, versión activa, fechas...) es escribible desde el cliente'
);

-- 5) Todas las funciones SECURITY DEFINER fijan search_path (evita secuestro de funciones).
select is(
  (select coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'),
  '',
  'toda función SECURITY DEFINER fija search_path'
);

-- 6) Superficie de la API: qué funciones de `public` puede ejecutar cada rol (lista blanca).
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  'explore_creators, explore_games, game_delivery, play_heartbeat, random_game, search_games, start_play, submit_copyright_claim, username_available',
  'anon solo puede ejecutar las funciones públicas previstas'
);
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')),
  'accept_terms, account_files, check_usage, clear_featured_game, complete_onboarding, confirm_version_upload, create_game_version, delete_my_account, edit_post, explore_creators, explore_games, game_delivery, lift_suspension, moderate_content, my_decisions, play_heartbeat, random_game, resolve_appeal, resolve_claim, resolve_report, search_games, set_active_version, set_comment_helpful, set_featured_game, start_play, submit_appeal, submit_copyright_claim, suspend_account, take_claim, take_report, username_available',
  'authenticated solo puede ejecutar las funciones públicas previstas'
);

select * from finish();
rollback;
