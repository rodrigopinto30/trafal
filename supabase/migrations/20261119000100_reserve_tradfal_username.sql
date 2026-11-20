-- The site is now called Tradfal: its name is reserved like the old one, so nobody can pass as the team.
create or replace function private.reserved_usernames() returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'admin', 'administrator', 'administrador', 'root', 'system', 'sistema', 'tradfal', 'trafal', 'staff',
    'soporte', 'support', 'help', 'ayuda', 'moderator', 'moderador', 'mod', 'api', 'www', 'null',
    'undefined', 'anonymous', 'anonimo', 'me'
  ];
$$;
