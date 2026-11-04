-- Trafal · datos de desarrollo (SOLO local: `supabase db reset` los carga; producción no corre este archivo).
--
-- Cuentas de prueba (contraseña de todas: trafal123):
--   valen@trafal.test  → @valen_makes   (usuaria)
--   mateo@trafal.test  → @mateo_g       (usuario)
--   admin@trafal.test  → @equipo_trafal (admin)
--
-- Se crean como lo haría GoTrue (auth.users + auth.identities) para poder iniciar sesión de verdad.
-- La Fase 4 amplía este seed a 10 usuarios, 16 juegos y 30 avances con comentarios.

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('5eed0000-0000-4000-8000-000000000001'::uuid, 'valen@trafal.test', 'valen_makes',   'Valentina Ruiz', 'user',  'es', 'Aprendiendo Godot de noche. Me encantan los plataformas difíciles.', 'Córdoba',   'AR', array['godot'],            array['platformer', 'roguelike', 'puzzle']),
      ('5eed0000-0000-4000-8000-000000000002'::uuid, 'mateo@trafal.test', 'mateo_g',       'Mateo G.',       'user',  'es', 'De Scratch a Phaser. Hago juegos de naves con música chiptune.',     'Rosario',   'AR', array['phaser', 'scratch'], array['arcade', 'shooter', 'rhythm']),
      ('5eed0000-0000-4000-8000-0000000000ad'::uuid, 'admin@trafal.test', 'equipo_trafal', 'Equipo Trafal',  'admin', 'es', 'Cuenta de moderación del equipo.',                                  null,        null, array[]::text[],           array[]::text[])
    ) as t(id, email, username, display_name, role, locale, bio, city, country, engines, favorite_genres)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('trafal123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );

    insert into public.profiles (id, username, display_name, bio, city, country, engines, favorite_genres)
    values (u.id, u.username, u.display_name, u.bio, u.city, u.country, u.engines, u.favorite_genres);

    insert into public.profile_private (id, role, locale, terms_version, terms_accepted_at, age_confirmed_at)
    values (u.id, u.role, u.locale, '2026-11', now(), now());
  end loop;

  -- Valentina sigue a Mateo para tener un follow de ejemplo.
  insert into public.follows (follower_id, followee_id)
  values ('5eed0000-0000-4000-8000-000000000001', '5eed0000-0000-4000-8000-000000000002');
end;
$$;
