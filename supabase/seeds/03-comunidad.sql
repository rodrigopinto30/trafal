-- Avances, comentarios, me gusta y popularidad de los juegos de ejemplo.

insert into public.posts (author_id, kind, body, game_id, highlight, created_at)
select game.owner_id, 'nuevo_juego', v.body, game.id, null, game.published_at + interval '10 minutes'
from (values
  ('luciernaga-valiente', 'Publiqué Luciérnaga Valiente: una luciérnaga, una cueva oscura y plataformas que solo aparecen con tu luz. Contame qué tal el nivel 3.'),
  ('granja-cuantica',     'Ya está Granja Cuántica. Plantás zanahorias que existen solo si no las mirás. Salió más raro de lo que planeaba.'),
  ('neon-express',        'Neón Express ya se juega en el navegador: naves, chiptune y un jefe final por nivel. Gracias a quienes me ayudaron con la música.'),
  ('chancleta-run',       'Subí Chancleta Run, inspirado en mi propia abuela. Se corre, se salta y se sobrevive.'),
  ('colectivo-152',       'Mi primer juego terminado: Colectivo 152. Llegá a la parada antes de que arranque. Acepto críticas, mates y colectivos.'),
  ('orbita',              '¡Publiqué mi primer juego! Se llama Órbita: lanzás planetas y la gravedad hace el resto. ¿Los niveles se entienden solos?'),
  ('torre-de-termos',     'Torre de Termos ya está online. Apilá, rotá y rezá. Dicen que el piso 5 es imposible.'),
  ('el-faro',             'Mi primera historia interactiva está online: El Faro. Cuatro finales y un farero que no habla mucho.'),
  ('gato-laser',          'Gato Láser ya se puede jugar: espejos, luz y un gato exigente. Hay 20 niveles.'),
  ('bit-bakery',          'Bit Bakery es un juego de PICO-8 sobre una panadería caótica. Entra en un cartucho de 32 KB.'),
  ('mazmorra-1-bit',      'Subí Mazmorra 1-Bit, mi primer roguelike. Todo en blanco y negro, todo por turnos, todo puede salir mal.'),
  ('pulpo-dj',            'Pulpo DJ ya está online: un pulpo, ocho teclas y cinco canciones. Se aceptan quejas de coordinación.'),
  ('pasillo-9',           'Pasillo 9 está disponible. Es corto, es raro y conviene jugarlo de noche. Avisé.'),
  ('kart-de-carton',      '¡Mi primer juego! Kart de Cartón: tres pistas, autos de cajas y física exagerada.'),
  ('hechizo-404',         'Hechizo 404 ya está online: un mago cuyos hechizos fallan a propósito. Es una función, no un bug.'),
  ('isla-eco',            'Mi primer juego con exploración: Isla Eco. Gritá y seguí los ecos para descubrir qué esconde la isla.')
) as v(game, body)
join public.games game on game.public_id = v.game;

insert into public.posts (author_id, kind, body, game_id, highlight, created_at)
select game.owner_id, v.kind, v.body, game.id, v.highlight, now() - v.age
from (values
  ('luciernaga-valiente', 'pide_feedback', 'Agregué la mecánica de luz: ahora podés revelar plataformas ocultas. ¿Se entiende sin tutorial?', null,           interval '20 hours'),
  ('luciernaga-valiente', 'hito',          '¡Pasamos las mil jugadas! Gracias a todas las personas que probaron la luciérnaga.',               '1000 jugadas', interval '6 hours'),
  ('neon-express',        'avance',        'Nuevo jefe final con patrón de balas en espiral. Lo estoy ajustando para que sea difícil pero justo.', null,       interval '3 days'),
  ('chancleta-run',       'hito',          'Actualización: ahora la abuela cambia de chancleta (y de puntería).',                              'v1.1',         interval '5 days'),
  ('orbita',              'avance',        'Probando un planeta con anillos que desvía la trayectoria. Sale en la próxima versión.',           null,           interval '2 hours'),
  ('torre-de-termos',     'pide_feedback', '¿Les parece muy difícil el piso 5? Mucha gente se cae ahí y no sé si es mi culpa.',                null,           interval '3 days'),
  ('el-faro',             'avance',        'Escribí el cuarto final. Prometo que es el más triste.',                                           null,           interval '12 hours'),
  ('gato-laser',          'avance',        'Sprite nuevo del gato, antes y después: ahora tiene bigotes animados.',                            null,           interval '1 day'),
  ('hechizo-404',         'pide_feedback', '¿Los hechizos fallan demasiado o muy poco? Necesito jugadores para balancear.',                    null,           interval '4 days'),
  ('bit-bakery',          'hito',          'Conseguí meter todo el juego en 32 KB. PICO-8 es un gran límite creativo.',                        '32 KB',        interval '10 days'),
  ('mazmorra-1-bit',      'avance',        'Generación de pisos nueva: ahora hay salas secretas con tesoro.',                                  null,           interval '2 days'),
  ('pulpo-dj',            'avance',        'Agregué la canción número 5. Es la más difícil, avisé.',                                           null,           interval '1 day'),
  ('kart-de-carton',      'pide_feedback', 'Probé la pista 3 y el auto se siente muy resbaloso. ¿Cómo lo ven?',                                null,           interval '6 days'),
  ('isla-eco',            'avance',        'Dibujé el mapa de la isla a mano antes de programarlo. Así se ve.',                                null,           interval '1 day 3 hours')
) as v(game, kind, body, highlight, age)
join public.games game on game.public_id = v.game;

insert into public.comments (author_id, game_id, body, label, created_at)
select author.id, game.id, v.body, v.label, least(now() - interval '1 minute', game.published_at + v.after)
from (values
  ('luciernaga-valiente', 'tomi_dev',    'La luz que revela plataformas es una idea genial. El nivel 3 me hizo transpirar, pero salió.',            'liked',      interval '5 hours'),
  ('luciernaga-valiente', 'sofi_pixels', 'Muy lindo el arte de la cueva. Lo terminé en diez minutos y quedé con ganas de más.',                     'liked',      interval '9 hours'),
  ('luciernaga-valiente', 'mateo_g',     '¿Podrías sumar un modo de práctica sin caídas? A veces cuesta calcular los saltos.',                      'suggestion', interval '14 hours'),
  ('granja-cuantica',     'julistudio',  'Zanahorias que existen y no existen: la idea más rara y relajante que jugué.',                            'liked',      interval '8 hours'),
  ('neon-express',        'male_beats',  'La música chiptune me tuvo bailando en la silla. El jefe final está durísimo (en el buen sentido).',      'liked',      interval '1 day'),
  ('neon-express',        'santi_unity', 'Se siente rapidísimo y justo. Pasé media hora intentando el nivel 4.',                                    'liked',      interval '2 days'),
  ('neon-express',        'sofi_pixels', 'Sumar una opción de dificultad ayudaría a que lo disfrute más gente.',                                   'suggestion', interval '4 days'),
  ('chancleta-run',       'santi_unity', 'Mi abuela me hizo correr igual que en este juego. Muy bueno el humor.',                                   'liked',      interval '3 days'),
  ('colectivo-152',       'caro_pixels', 'Ese 152 existe en mi ciudad, lo juro. Reflejos al máximo.',                                              'liked',      interval '20 hours'),
  ('orbita',              'mateo_g',     'Me encantó usar la gravedad de las estrellas para lanzar. Lo jugué dos veces seguidas.',                  'liked',      interval '1 hour'),
  ('orbita',              'caro_pixels', 'Un puzzle con una idea clarísima. Para ser un primer juego, sorprende.',                                  'liked',      interval '3 hours'),
  ('torre-de-termos',     'mateo_g',     'Estaría bueno ver un contador de altura. Me caí en el piso 5 varias veces.',                              'suggestion', interval '2 days'),
  ('el-faro',             'valen_makes', 'Lloré con el tercer final. Gracias por una historia tan cuidada.',                                        'liked',      interval '10 hours'),
  ('el-faro',             'julistudio',  'La ambientación del mar es hermosa. Con un mate en la mano, quince minutos perfectos.',                   'liked',      interval '20 hours'),
  ('gato-laser',          'caro_pixels', 'Mi gato se quedó mirando la pantalla todo el rato. Aprobado por felinos.',                               'liked',      interval '2 days'),
  ('bit-bakery',          'valen_makes', 'El caos de la cocina contra el reloj es adictivo. Mi récord: doce facturas.',                            'liked',      interval '7 days'),
  ('mazmorra-1-bit',      'valen_makes', 'Me gustaría un mapa chiquito de cada piso. Muy buen ritmo por turnos.',                                   'suggestion', interval '3 days'),
  ('pulpo-dj',            'mateo_g',     'Cero coordinación, diez de diversión. El tentáculo de la J me traicionó.',                                'liked',      interval '2 days'),
  ('pasillo-9',           'sofi_pixels', 'Jugalo con auriculares y la luz apagada. Encontré la anomalía y igual me asusté.',                        'liked',      interval '1 day'),
  ('pasillo-9',           'valen_makes', 'Podrías agregar un sonido cuando se marca bien la anomalía, así uno sabe que acertó.',                    'suggestion', interval '3 days'),
  ('kart-de-carton',      'tomi_dev',    'La física tonta de los autos de cartón me hizo reír mucho.',                                              'liked',      interval '6 days'),
  ('kart-de-carton',      'male_beats',  'El auto se siente algo resbaloso en la pista 3. Quizás más agarre en las curvas.',                        'suggestion', interval '7 days'),
  ('hechizo-404',         'male_beats',  'Que el hechizo falle a propósito es una mecánica brillante.',                                             'liked',      interval '4 days'),
  ('isla-eco',            'nachodev',    'Una isla que responde con ecos es hermoso. Me quedé escuchando un rato largo.',                           'liked',      interval '1 day')
) as v(game, author, body, label, after)
join public.games game on game.public_id = v.game
join public.profiles author on author.username = v.author;

insert into public.comments (author_id, game_id, parent_id, body, created_at)
select author.id, game.id, parent.id, v.body, least(now() - interval '1 minute', game.published_at + v.after)
from (values
  ('luciernaga-valiente', 'mateo_g',    'valen_makes', '¡Buena idea! Lo anoto para la próxima versión.',        interval '16 hours'),
  ('kart-de-carton',      'male_beats', 'santi_unity', 'Gracias, voy a subir el agarre en la v1.1.',            interval '8 days'),
  ('torre-de-termos',     'mateo_g',    'sofi_pixels', 'Perfecto, agrego un contador de altura esta semana.',   interval '3 days')
) as v(game, parent_author, author, body, after)
join public.games game on game.public_id = v.game
join public.profiles author on author.username = v.author
join public.profiles parent_author on parent_author.username = v.parent_author
join public.comments parent on parent.game_id = game.id and parent.author_id = parent_author.id and parent.parent_id is null;

insert into public.comments (author_id, post_id, body, created_at)
select author.id, post.id, v.body, now() - v.age
from (values
  ('kart-de-carton',      'mateo_g',     'A mí me pareció bien, pero la curva 2 sí es medio resbaladiza.',   interval '5 days'),
  ('torre-de-termos',     'valen_makes', 'El piso 5 es difícil pero se puede. No lo cambies mucho.',        interval '2 days'),
  ('hechizo-404',         'male_beats',  'Fallan justo lo necesario. No los toques.',                       interval '3 days'),
  ('luciernaga-valiente', 'tomi_dev',    'Se entiende solo, la luz hace de tutorial.',                      interval '18 hours')
) as v(game, author, body, age)
join public.games game on game.public_id = v.game
join public.profiles author on author.username = v.author
join public.posts post on post.game_id = game.id and post.kind = 'pide_feedback';

insert into public.game_likes (user_id, game_id, created_at)
select profile.id, game.id, least(now(), game.published_at + interval '30 minutes')
from public.games game
cross join public.profiles profile
where profile.id <> game.owner_id
  and profile.username <> 'equipo_trafal'
  and (hashtext(game.public_id || profile.username) % 3 + 3) % 3 = 0;

insert into public.post_likes (user_id, post_id, created_at)
select profile.id, post.id, least(now(), post.created_at + interval '20 minutes')
from public.posts post
cross join public.profiles profile
where profile.id <> post.author_id
  and profile.username <> 'equipo_trafal'
  and (hashtext(post.id::text || profile.username) % 2 + 2) % 2 = 0;

update public.games game
   set play_count = v.plays, like_count = v.likes, save_count = v.saves
from (values
  ('luciernaga-valiente', 3420, 248, 61),
  ('granja-cuantica',      980,  74, 18),
  ('neon-express',        6120, 412, 140),
  ('chancleta-run',       3880, 205, 52),
  ('colectivo-152',       1260,  87, 15),
  ('orbita',              1440,  97, 20),
  ('torre-de-termos',     1890, 121, 29),
  ('el-faro',              720,  51, 12),
  ('gato-laser',          2650, 180, 44),
  ('bit-bakery',          2010, 133, 31),
  ('mazmorra-1-bit',      1130,  88, 17),
  ('pulpo-dj',            2380, 156, 36),
  ('pasillo-9',           3040, 190, 47),
  ('kart-de-carton',      1510,  99, 22),
  ('hechizo-404',         2220, 143, 33),
  ('isla-eco',             840,  66, 11)
) as v(public_id, plays, likes, saves)
where game.public_id = v.public_id;
