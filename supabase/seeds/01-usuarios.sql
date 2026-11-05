-- Cuentas de desarrollo, contraseña de todas: trafal123. Solo local: `supabase db reset` las carga y producción no corre estos archivos.

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('5eed0000-0000-4000-8000-000000000001'::uuid, 'valen@trafal.test',  'valen_makes',   'Valentina Ruiz', 'user',  'Aprendiendo Godot de noche. Me encantan los plataformas difíciles.',        'Córdoba',      'AR', array['godot'],             array['platformer', 'roguelike', 'puzzle']),
      ('5eed0000-0000-4000-8000-000000000002'::uuid, 'mateo@trafal.test',  'mateo_g',       'Mateo G.',       'user',  'De Scratch a Phaser. Hago juegos de naves con música chiptune.',            'Rosario',      'AR', array['phaser', 'scratch'], array['arcade', 'shooter', 'rhythm']),
      ('5eed0000-0000-4000-8000-0000000000ad'::uuid, 'admin@trafal.test',  'equipo_trafal', 'Equipo Trafal',  'admin', 'Cuenta de moderación del equipo.',                                          null,           null, array[]::text[],            array[]::text[]),
      ('5eed0000-0000-4000-8000-000000000003'::uuid, 'sofi@trafal.test',   'sofi_pixels',   'Sofi Pixels',    'user',  'Puzzles de física y planetas. Programo después del laburo.',                'Mendoza',      'AR', array['unity'],             array['puzzle', 'simulation']),
      ('5eed0000-0000-4000-8000-000000000004'::uuid, 'nacho@trafal.test',  'nachodev',      'Nacho Dev',      'user',  'Historias interactivas con olor a mar y a mate.',                           'Montevideo',   'UY', array['twine'],             array['narrative', 'adventure']),
      ('5eed0000-0000-4000-8000-000000000005'::uuid, 'juli@trafal.test',   'julistudio',    'Juli Studio',    'user',  'Hago juegos con gatos. Sí, otra vez gatos.',                                'La Plata',     'AR', array['gamemaker'],         array['puzzle', 'roguelike']),
      ('5eed0000-0000-4000-8000-000000000006'::uuid, 'caro@trafal.test',   'caro_pixels',   'Caro Pixels',    'user',  'Fantasy console y mucho pan dulce.',                                        'Santiago',     'CL', array['pico8'],             array['cozy', 'adventure']),
      ('5eed0000-0000-4000-8000-000000000007'::uuid, 'tomi@trafal.test',   'tomi_dev',      'Tomi',           'user',  'Mazmorras y pasillos raros, siempre en Godot.',                             'Bogotá',       'CO', array['godot'],             array['roguelike', 'horror']),
      ('5eed0000-0000-4000-8000-000000000008'::uuid, 'male@trafal.test',   'male_beats',    'Male Beats',     'user',  'Ritmo, chiptune y tentáculos.',                                             'Buenos Aires', 'AR', array['phaser'],            array['rhythm', 'arcade']),
      ('5eed0000-0000-4000-8000-000000000009'::uuid, 'santi@trafal.test',  'santi_unity',   'Santi',          'user',  'Autos de cartón y física divertida.',                                       'Lima',         'PE', array['unity'],             array['racing', 'sports'])
    ) as t(id, email, username, display_name, role, bio, city, country, engines, favorite_genres)
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
    values (u.id, u.role, 'es', '2026-11-04', now(), now());
  end loop;

  insert into public.follows (follower_id, followee_id)
  select follower.id, followee.id
  from (values
    ('valen_makes', 'mateo_g'), ('valen_makes', 'sofi_pixels'), ('valen_makes', 'tomi_dev'),
    ('mateo_g', 'male_beats'), ('mateo_g', 'sofi_pixels'),
    ('sofi_pixels', 'valen_makes'), ('sofi_pixels', 'julistudio'),
    ('nachodev', 'caro_pixels'), ('nachodev', 'valen_makes'),
    ('julistudio', 'caro_pixels'), ('julistudio', 'mateo_g'),
    ('caro_pixels', 'nachodev'), ('caro_pixels', 'valen_makes'),
    ('tomi_dev', 'valen_makes'), ('tomi_dev', 'santi_unity'),
    ('male_beats', 'mateo_g'), ('male_beats', 'julistudio'),
    ('santi_unity', 'tomi_dev'), ('santi_unity', 'sofi_pixels')
  ) as pair(follower, followee)
  join public.profiles follower on follower.username = pair.follower
  join public.profiles followee on followee.username = pair.followee;
end;
$$;
