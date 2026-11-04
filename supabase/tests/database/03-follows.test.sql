-- Seguir / dejar de seguir.
begin;
select no_plan();
select tests.wipe_app_data();

select tests.create_profile('a0000000-0000-0000-0000-000000000001', 'ana');
select tests.create_profile('b0000000-0000-0000-0000-000000000002', 'bruno');
select tests.create_profile('c0000000-0000-0000-0000-000000000003', 'carla');
select tests.create_user('nuevo@trafal.test', 'e0000000-0000-0000-0000-000000000005');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.follows (follower_id, followee_id) values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002') $$, 'ana sigue a bruno');
select throws_ok($$ insert into public.follows (follower_id, followee_id) values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002') $$, '23505', null, 'no se puede seguir dos veces');
select throws_ok($$ insert into public.follows (follower_id, followee_id) values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001') $$, '23514', null, 'nadie se sigue a sí mismo');
select throws_ok($$ insert into public.follows (follower_id, followee_id) values ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002') $$, '42501', null, 'ana NO puede hacer que carla siga a bruno');
select throws_ok($$ insert into public.follows (follower_id, followee_id, created_at) values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', '2000-01-01') $$, '42501', null, 'la fecha no se elige');

select is((select followers_count from public.profiles where username = 'bruno'), 1::bigint::int, 'contador de seguidores de bruno = 1');
select is((select following_count from public.profiles where username = 'ana'), 1::bigint::int, 'contador de seguidos de ana = 1');

-- El grafo es público.
select tests.authenticate_as_anon();
select is((select count(*) from public.follows), 1::bigint, 'los visitantes ven quién sigue a quién');
select throws_ok($$ insert into public.follows (follower_id, followee_id) values ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001') $$, '42501', null, 'anon no puede seguir');
select throws_ok($$ delete from public.follows $$, '42501', null, 'anon no borra follows');

-- Otra persona no puede deshacer el follow de ana.
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select is(tests.dml_count($$ delete from public.follows where follower_id = 'a0000000-0000-0000-0000-000000000001' $$), 0::bigint, 'carla NO borra el follow de ana (0 filas)');
select is((select count(*) from public.follows), 1::bigint, 'el follow sigue ahí');

-- Quien no completó el onboarding no puede seguir.
select tests.authenticate_as('e0000000-0000-0000-0000-000000000005');
select throws_ok($$ insert into public.follows (follower_id, followee_id) values ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001') $$, '42501', null, 'sin perfil no se puede seguir');

-- Una cuenta suspendida no puede seguir.
select tests.clear_authentication();
update public.profile_private set status = 'suspended' where id = 'c0000000-0000-0000-0000-000000000003';
select tests.authenticate_as('c0000000-0000-0000-0000-000000000003');
select throws_ok($$ insert into public.follows (follower_id, followee_id) values ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001') $$, '42501', null, 'una cuenta suspendida no puede seguir');

-- Ana deja de seguir: los contadores vuelven a cero.
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(tests.dml_count($$ delete from public.follows where followee_id = 'b0000000-0000-0000-0000-000000000002' $$), 1::bigint, 'ana deja de seguir a bruno');
select is((select followers_count from public.profiles where username = 'bruno'), 0, 'contador de seguidores vuelve a 0');
select is((select following_count from public.profiles where username = 'ana'), 0, 'contador de seguidos vuelve a 0');

select * from finish();
rollback;
