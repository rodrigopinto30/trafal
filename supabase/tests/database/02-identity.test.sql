-- Perfiles, datos privados, suspensión y onboarding.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('d0000000-0000-0000-0000-0000000000ad', 'admina', 'admin');
-- Alguien que se registró pero todavía no hizo el onboarding (no tiene perfil).
select tests.create_user('nuevo@trafal.test', 'e0000000-0000-0000-0000-000000000005');

-- La regla del @usuario también vive en un CHECK de la tabla (no solo en las funciones): se prueba con la conexión privilegiada,
-- porque las personas comunes no pueden insertar perfiles a mano.
select throws_ok($$ insert into public.profiles (id, username, display_name) values ('e0000000-0000-0000-0000-000000000005', 'con espacio', 'X') $$, '23514', null, 'la base rechaza un @usuario con espacios (CHECK)');
select throws_ok($$ insert into public.profiles (id, username, display_name) values ('e0000000-0000-0000-0000-000000000005', 'abc.', 'X') $$, '23514', null, 'la base rechaza un @usuario que termina en punto (CHECK)');
select lives_ok($$ select 1 where private.is_valid_username('rodri') and private.is_valid_username('_x_') and not private.is_valid_username('a..b') $$, 'private.is_valid_username aplica la misma regla');

-- ---------------------------------------------------------------- visitantes
select tests.authenticate_as_anon();
select is((select count(*) from public.profiles), 3::bigint, 'los perfiles son públicos para cualquiera');
select is((select count(*) from public.engines), 9::bigint, 'el catálogo de motores es público');
select is((select count(*) from public.genres), 17::bigint, 'el catálogo de géneros es público');
select throws_ok($$ select * from public.profile_private $$, '42501', null, 'anon NO puede leer datos privados');
select throws_ok($$ insert into public.engines (id) values ('hack') $$, '42501', null, 'anon no escribe catálogos');
select throws_ok($$ update public.profiles set bio = 'x' $$, '42501', null, 'anon no edita perfiles');
select throws_ok($$ select public.complete_onboarding('zzz_user', 'Z', '2026-11', true, true) $$, '42501', null, 'anon no puede hacer onboarding');

-- ---------------------------------------------------------------- ana (usuaria común)
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.profile_private), 1::bigint, 'ana solo ve su propia fila privada');
select is((select role from public.profile_private), 'user', 'ana tiene rol user');
select is(private.is_admin(), false, 'ana no es admin');
select is(private.can_write(), true, 'ana puede escribir');

select is(tests.dml_count($$ update public.profiles set bio = 'Hago juegos' where username = 'ana' $$), 1::bigint, 'ana edita su perfil');
select is(tests.dml_count($$ update public.profiles set bio = 'hackeado' where username = 'bruno' $$), 0::bigint, 'ana NO edita el perfil de bruno (RLS filtra la fila)');
select throws_ok($$ update public.profiles set username = 'otro' where username = 'ana' $$, '42501', null, 'el username es inmutable');
select throws_ok($$ update public.profiles set followers_count = 999 where username = 'ana' $$, '42501', null, 'los contadores no se escriben desde el cliente');
select throws_ok($$ update public.profiles set id = gen_random_uuid() where username = 'ana' $$, '42501', null, 'el id no se cambia');
select throws_ok($$ update public.profile_private set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001' $$, '42501', null, 'nadie se hace admin por su cuenta');
select throws_ok($$ update public.profile_private set status = 'active' where id = 'a0000000-0000-0000-0000-000000000001' $$, '42501', null, 'nadie cambia su estado de suspensión');
select throws_ok($$ update public.profile_private set terms_version = 'x' where id = 'a0000000-0000-0000-0000-000000000001' $$, '42501', null, 'los términos aceptados no se reescriben');
select is(tests.dml_count($$ update public.profile_private set locale = 'en' where id = 'a0000000-0000-0000-0000-000000000001' $$), 1::bigint, 'ana cambia su idioma');
select is(tests.dml_count($$ update public.profile_private set locale = 'en' where id = 'b0000000-0000-0000-0000-000000000002' $$), 0::bigint, 'ana NO cambia el idioma de bruno');
select throws_ok($$ update public.profile_private set locale = 'fr' where id = 'a0000000-0000-0000-0000-000000000001' $$, '23514', null, 'idioma inválido');
select throws_ok($$ insert into public.profiles (id, username, display_name) values (gen_random_uuid(), 'zzz_user', 'Z') $$, '42501', null, 'los perfiles no se crean a mano (solo por onboarding)');
select throws_ok($$ insert into public.profile_private (id, role, terms_version, terms_accepted_at, age_confirmed_at) values ('a0000000-0000-0000-0000-000000000001', 'admin', 'x', now(), now()) $$, '42501', null, 'tampoco los datos privados');
select throws_ok($$ delete from public.profiles where username = 'ana' $$, '42501', null, 'el perfil no se borra desde el cliente');

-- Validaciones de datos
select throws_ok($$ update public.profiles set bio = repeat('x', 281) where username = 'ana' $$, '23514', null, 'bio de más de 280 caracteres');
select throws_ok($$ update public.profiles set country = 'arg' where username = 'ana' $$, '23514', null, 'país: ISO-2 en mayúsculas');
select throws_ok($$ update public.profiles set display_name = '   ' where username = 'ana' $$, '23514', null, 'nombre vacío');
select lives_ok($$ update public.profiles set country = 'AR', city = 'Rosario', engines = array['unity', 'godot', 'unity'] where username = 'ana' $$, 'datos válidos');
select is((select engines from public.profiles where username = 'ana'), array['godot', 'unity'], 'motores sin duplicados y ordenados');
select throws_ok($$ update public.profiles set engines = array['nope'] where username = 'ana' $$, '22023', 'invalid_engine', 'motor inexistente');
select throws_ok($$ update public.profiles set engines = array['godot','unity','gamemaker','phaser','pico8','scratch','twine','construct','other'] where username = 'ana' $$, '23514', null, 'más de 8 motores');
select is((select engines from public.profiles where username = 'ana'), array['godot', 'unity'], 'los intentos fallidos no tocan los motores');

-- Géneros favoritos (la grilla del perfil)
select lives_ok($$ update public.profiles set favorite_genres = array['strategy', 'arcade', 'strategy'] where username = 'ana' $$, 'géneros favoritos válidos');
select is((select favorite_genres from public.profiles where username = 'ana'), array['arcade', 'strategy'], 'géneros sin duplicados y ordenados');
select throws_ok($$ update public.profiles set favorite_genres = array['nope'] where username = 'ana' $$, '22023', 'invalid_genre', 'género inexistente');
select is((select favorite_genres from public.profiles where username = 'ana'), array['arcade', 'strategy'], 'un género inválido no deja el perfil a medias');
select lives_ok($$ update public.profiles set favorite_genres = array['idle', 'fighting', 'shooter', 'sports', 'simulation'] where username = 'ana' $$, 'los géneros nuevos del catálogo existen');
select lives_ok($$ update public.profiles set favorite_genres = '{}' where username = 'ana' $$, 'se pueden quitar todos los géneros');
select is(tests.dml_count($$ update public.profiles set favorite_genres = array['arcade'] where username = 'bruno' $$), 0::bigint, 'ana NO cambia los géneros de bruno');

-- Foto de perfil: la base solo acepta una ruta dentro de la carpeta de la propia persona
select lives_ok($$ update public.profiles set avatar_path = 'avatars/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.webp' where username = 'ana' $$, 'ana guarda la ruta de su foto');
select lives_ok($$ update public.profiles set avatar_path = 'avatars/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.jpg' where username = 'ana' $$, 'también jpg');
select lives_ok($$ update public.profiles set avatar_path = 'avatars/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.png' where username = 'ana' $$, 'y png');
select throws_ok($$ update public.profiles set avatar_path = 'avatars/b0000000-0000-0000-0000-000000000002/0123456789abcdef0123456789abcdef.webp' where username = 'ana' $$, '23514', null, 'no se puede apuntar la foto a la carpeta de otra persona');
select throws_ok($$ update public.profiles set avatar_path = 'avatars/a0000000-0000-0000-0000-000000000001/../b0000000-0000-0000-0000-000000000002/0123456789abcdef0123456789abcdef.webp' where username = 'ana' $$, '23514', null, 'tampoco con «..»');
select throws_ok($$ update public.profiles set avatar_path = 'games/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.webp' where username = 'ana' $$, '23514', null, 'tampoco a otra carpeta del almacenamiento');
select throws_ok($$ update public.profiles set avatar_path = 'avatars/a0000000-0000-0000-0000-000000000001/foto.svg' where username = 'ana' $$, '23514', null, 'solo webp, jpg o png (nada de svg)');
select throws_ok($$ update public.profiles set avatar_path = 'https://evil.example/x.png' where username = 'ana' $$, '23514', null, 'ni URLs externas');
select lives_ok($$ update public.profiles set avatar_path = null where username = 'ana' $$, 'ana quita su foto');

-- ---------------------------------------------------------------- admin
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is(private.is_admin(), true, 'la admin es admin');
select is((select count(*) from public.profile_private), 3::bigint, 'la admin ve los datos privados de todas las cuentas');
select is(tests.dml_count($$ update public.profiles set bio = 'moderada' where username = 'ana' $$), 0::bigint, 'ni siquiera la admin edita perfiles ajenos por tabla (la moderación va por funciones)');

-- ---------------------------------------------------------------- suspensión
select tests.clear_authentication();
update public.profile_private set status = 'suspended', suspension_reason = 'prueba' where id = 'a0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(private.can_write(), false, 'una cuenta suspendida no puede escribir');
select is(tests.dml_count($$ update public.profiles set bio = 'sigo editando' where username = 'ana' $$), 0::bigint, 'suspendida no edita su perfil');

select tests.clear_authentication();
update public.profile_private set suspended_until = now() - interval '1 minute' where id = 'a0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(private.can_write(), true, 'una suspensión temporal vencida se levanta sola');

select tests.clear_authentication();
update public.profile_private set status = 'suspended', suspended_until = now() + interval '1 day' where id = 'd0000000-0000-0000-0000-0000000000ad';
select tests.authenticate_as('d0000000-0000-0000-0000-0000000000ad');
select is(private.is_admin(), false, 'una admin suspendida pierde sus poderes');

-- ---------------------------------------------------------------- onboarding
select tests.authenticate_as('e0000000-0000-0000-0000-000000000005');
select is(private.can_write(), false, 'sin onboarding no se puede escribir');
select is(public.username_available('Nuevo_User'), true, 'disponible (da igual mayúsculas/minúsculas)');
select is(public.username_available('ana'), false, 'ocupado');
select is(public.username_available('ANA'), false, 'ocupado aunque lo escriban en mayúsculas');
select is(public.username_available('admin'), false, 'reservado');
select is(public.username_available('trafal'), false, 'reservado');
select is(public.username_available('a'), false, 'muy corto');
select is(public.username_available('ab'), false, 'muy corto (el mínimo es 3)');
select is(public.username_available('con espacio'), false, 'sin espacios');
select is(public.username_available('con-guion'), false, 'sin guion medio');
select is(public.username_available('ñandu'), false, 'solo letras ASCII (la interfaz saca los acentos antes de llegar acá)');
select is(public.username_available('valen_makes'), true, 'guion bajo permitido');
select is(public.username_available('agus.codes'), true, 'punto permitido');
-- «Si está libre, se puede usar»: no se exigen números ni una forma especial.
select is(public.username_available('rodri'), true, 'un nombre libre SIN números se puede usar');
select is(public.username_available('rodrigopinto'), true, 'tampoco hace falta separador');
select is(public.username_available('a__b'), true, 'guiones bajos seguidos permitidos');
select is(public.username_available('_abc'), true, 'puede empezar con guion bajo');
select is(public.username_available('abc_'), true, 'puede terminar con guion bajo');
select is(public.username_available('a._b'), true, 'punto junto a guion bajo permitido');
select is(public.username_available(repeat('x', 30)), true, 'hasta 30 caracteres');
select is(public.username_available(repeat('x', 31)), false, 'más de 30 caracteres');
select is(public.username_available('abc.'), false, 'no termina con punto');
select is(public.username_available('.abc'), false, 'no empieza con punto');
select is(public.username_available('a..b'), false, 'sin puntos seguidos');
select is(public.username_available('___'), false, 'tiene que haber al menos una letra o un número');
select is(public.username_available('explore'), true, 'las palabras de rutas del sitio ya no están reservadas (los perfiles viven en /u/)');
select is(public.username_available('soporte'), false, 'las que permitirían hacerse pasar por el equipo siguen reservadas');

select throws_ok($$ select public.complete_onboarding('nuevo_user', 'Nuevo', '2026-11', true, false) $$, 'P0001', 'age_confirmation_required', 'exige confirmar la edad (18+)');
select throws_ok($$ select public.complete_onboarding('nuevo_user', 'Nuevo', '2026-11', false, true) $$, 'P0001', 'terms_required', 'exige aceptar los términos');
select throws_ok($$ select public.complete_onboarding('a', 'Nuevo', '2026-11', true, true) $$, 'P0001', 'invalid_username', 'username inválido');
select throws_ok($$ select public.complete_onboarding('abc.', 'Nuevo', '2026-11', true, true) $$, 'P0001', 'invalid_username', 'username que termina en punto');
select throws_ok($$ select public.complete_onboarding('trafal', 'Nuevo', '2026-11', true, true) $$, 'P0001', 'reserved_username', 'username reservado');
select throws_ok($$ select public.complete_onboarding('Soporte', 'Nuevo', '2026-11', true, true) $$, 'P0001', 'reserved_username', 'username reservado (sin distinguir mayúsculas)');
select throws_ok($$ select public.complete_onboarding('nuevo_user', '   ', '2026-11', true, true) $$, 'P0001', 'invalid_display_name', 'nombre vacío');
select throws_ok($$ select public.complete_onboarding('Ana', 'Otra Ana', '2026-11', true, true) $$, 'P0001', 'username_taken', 'username ocupado (sin distinguir mayúsculas)');
select is((select count(*) from public.profiles where id = 'e0000000-0000-0000-0000-000000000005'), 0::bigint, 'los intentos fallidos no dejan perfiles a medias');

select lives_ok($$ select public.complete_onboarding('Nuevo_User', '  Nuevo  ', '2026-11', true, true, 'en') $$, 'onboarding correcto');
select is((select username from public.profiles where id = 'e0000000-0000-0000-0000-000000000005'), 'nuevo_user', 'el username se guarda en minúsculas');
select is((select display_name from public.profiles where id = 'e0000000-0000-0000-0000-000000000005'), 'Nuevo', 'el nombre se guarda sin espacios sobrantes');
select is((select locale from public.profile_private), 'en', 'idioma elegido');
select is((select role from public.profile_private), 'user', 'el onboarding nunca crea admins');
select is((select status from public.profile_private), 'active', 'cuenta activa');
select isnt((select terms_accepted_at from public.profile_private), null, 'queda registrada la aceptación de términos');
select isnt((select age_confirmed_at from public.profile_private), null, 'queda registrada la confirmación de edad');
select is(private.can_write(), true, 'después del onboarding ya puede escribir');
select throws_ok($$ select public.complete_onboarding('otro_nombre', 'Otro', '2026-11', true, true) $$, 'P0001', 'already_onboarded', 'no se puede repetir el onboarding');

select * from finish();
rollback;
