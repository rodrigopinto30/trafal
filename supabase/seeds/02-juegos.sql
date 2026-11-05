-- 16 juegos publicados de ejemplo con una versión lista cada uno, y el primer juego de la semana.

do $$
declare
  g record;
  v_game uuid;
  v_version uuid;
begin
  for g in
    select * from (values
      ('luciernaga-valiente', 'valen_makes', 'Luciérnaga Valiente',
       'Plataformas corto en una cueva oscura: guiá a una luciérnaga con su propia luz y llegá a la salida sin caer al vacío.',
       'Flechas o A/D para moverte. Espacio para saltar (dos veces en el aire). Shift hace brillar la luz y revela plataformas ocultas. R reinicia el nivel.',
       'platformer', 'godot', array['cueva', 'pixel-art', 'corto'], false, '16:9', true, interval '2 days 3 hours'),
      ('granja-cuantica', 'valen_makes', 'Granja Cuántica',
       'Plantá zanahorias que existen y no existen: cada cosecha depende de cuándo mires el campo. Relajante y raro.',
       'Tocá o hacé clic en un surco para plantar. Dejá el mouse sobre una planta para observarla (al mirar se define si existe). Cosechá con doble toque o clic derecho.',
       'cozy', 'godot', array['granja', 'relajante', 'zanahorias'], true, '4:3', false, interval '1 day 5 hours'),
      ('neon-express', 'mateo_g', 'Neón Express',
       'Arcade de naves con música chiptune: esquivá asteroides, juntá cristales y llegá al jefe final de cada nivel.',
       'Flechas o WASD para mover la nave. Espacio dispara. Mantené Shift para ir más lento y esquivar mejor. En celular, arrastrá el dedo: la nave dispara sola.',
       'arcade', 'phaser', array['naves', 'chiptune', 'espacio'], true, '16:9', false, interval '9 days 2 hours'),
      ('chancleta-run', 'mateo_g', 'Chancleta Run',
       'Escapá de la chancleta voladora de la abuela: corré por el pasillo, saltá los muebles y llegá a la puerta antes de que te alcance.',
       'Espacio o clic para saltar. Flecha abajo para agacharte. Cada 10 muebles esquivados, la abuela lanza más rápido.',
       'arcade', 'scratch', array['runner', 'humor', 'escapar'], true, '4:3', false, interval '12 days 6 hours'),
      ('colectivo-152', 'mateo_g', 'Colectivo 152',
       'Llegá a la parada antes de que arranque el colectivo: esquivá peatones y semáforos con el mate en la mano.',
       'Flechas para correr y cruzar la calle. Espacio para acelerar un instante (se recarga). Si el colectivo se va, empezás el día de nuevo.',
       'arcade', 'scratch', array['ciudad', 'reflejos', 'mate'], true, '4:3', true, interval '2 days 9 hours'),
      ('orbita', 'sofi_pixels', 'Órbita',
       'Lanzá planetas y jugá con la gravedad: llevá cada uno hasta su órbita usando las estrellas como impulso.',
       'Arrastrá desde el planeta para apuntar y soltá para lanzar: cuanto más largo el arrastre, más fuerza. Tocá una estrella para activar o apagar su gravedad.',
       'puzzle', 'unity', array['gravedad', 'física', 'planetas'], true, '16:9', true, interval '5 hours'),
      ('torre-de-termos', 'sofi_pixels', 'Torre de Termos',
       'Apilá termos sin que se caiga todo: cada piso nuevo es más inestable. ¿Hasta qué altura llegás?',
       'Mové el termo con el mouse o el dedo y soltalo con un clic. Rotalo con la rueda del mouse o con la tecla R. Si algo cae al suelo, perdés una vida.',
       'puzzle', 'unity', array['física', 'apilar', 'termos'], true, '4:3', false, interval '7 days 4 hours'),
      ('el-faro', 'nachodev', 'El Faro',
       'Historia interactiva de un farero solitario: tus decisiones cambian qué barcos llegan a la costa. Dura unos 15 minutos.',
       'Se juega leyendo: hacé clic en las opciones subrayadas para decidir. Tu progreso se guarda solo en el navegador. Hay cuatro finales distintos.',
       'narrative', 'twine', array['historia', 'interactivo', 'mar'], true, '4:3', true, interval '1 day 8 hours'),
      ('gato-laser', 'julistudio', 'Gato Láser',
       'Un gato, un láser y demasiados espejos: orientá los espejos para que el rayo llegue al gato antes de que se aburra.',
       'Clic sobre un espejo para rotarlo, o arrastralo para moverlo. La tecla Espacio enciende el láser. Los niveles se desbloquean en orden.',
       'puzzle', 'gamemaker', array['gatos', 'espejos', 'luz'], true, '16:9', false, interval '3 days 7 hours'),
      ('bit-bakery', 'caro_pixels', 'Bit Bakery',
       'Horneá todo antes de que abra la panadería: amasá, cociná y ordená las facturas contra el reloj.',
       'Flechas para moverte por la cocina. Z toma o deja un ingrediente. X usa el horno o la mesa. El reloj de arriba marca la hora de apertura.',
       'cozy', 'pico8', array['panadería', 'reloj', 'pixel-art'], false, '1:1', false, interval '15 days 1 hour'),
      ('mazmorra-1-bit', 'tomi_dev', 'Mazmorra 1-Bit',
       'Roguelike en blanco y negro por turnos: cada piso se genera distinto y morir significa empezar de nuevo.',
       'Flechas o WASD para moverte (un paso por turno). Chocar contra un enemigo lo ataca. E recoge objetos. I abre la mochila.',
       'roguelike', 'godot', array['blanco y negro', 'mazmorra', 'por turnos'], false, '1:1', true, interval '6 days 10 hours'),
      ('pulpo-dj', 'male_beats', 'Pulpo DJ',
       'Ritmo con ocho tentáculos y cero coordinación: apretá cada tecla justo cuando la nota cruza la línea.',
       'Usá las teclas A S D F J K L Ñ (una por tentáculo) o tocá los círculos en pantalla. Cuanto más exacto el momento, más puntos y más combo.',
       'rhythm', 'phaser', array['música', 'tentáculos', 'combo'], true, '16:9', false, interval '4 days 2 hours'),
      ('pasillo-9', 'tomi_dev', 'Pasillo 9',
       'Un pasillo que se repite y algo cambia cada vez: encontrá la anomalía y salí antes de volver a cruzarte con ella.',
       'WASD para caminar y mouse para mirar. Clic izquierdo marca la anomalía. Si no hay ninguna, volvé por el pasillo. Se disfruta más con auriculares.',
       'horror', 'godot', array['terror', 'pasillo', 'misterio'], false, '16:9', false, interval '5 days 11 hours'),
      ('kart-de-carton', 'santi_unity', 'Kart de Cartón',
       'Carreras con autos hechos de cajas de cartón: tres pistas, una vuelta de ventaja y mucha física tonta.',
       'Flechas o WASD para acelerar y girar. Espacio frena. Shift usa el turbo (se recarga). R te devuelve a la pista.',
       'racing', 'unity', array['carreras', 'cartón', 'física'], false, '16:9', true, interval '10 days 5 hours'),
      ('hechizo-404', 'julistudio', 'Hechizo 404',
       'Un mago cuyos hechizos fallan a propósito: aprovechá cada error para vencer a los monstruos de la mazmorra.',
       'Flechas para moverte. Z lanza el hechizo (el resultado es aleatorio). X cambia de varita. Cada piso te ofrece una mejora.',
       'roguelike', 'gamemaker', array['magia', 'humor', 'errores'], false, '4:3', false, interval '8 days 3 hours'),
      ('isla-eco', 'caro_pixels', 'Isla Eco',
       'Explorá una isla que te responde con ecos: gritá, escuchá y seguí las voces hasta el faro escondido.',
       'Flechas para caminar. Z grita: el eco te marca la dirección de los secretos. X abre el mapa. No hay enemigos, tomate tu tiempo.',
       'adventure', 'pico8', array['exploración', 'eco', 'misterio'], false, '1:1', true, interval '3 days 1 hour')
    ) as t(public_id, owner, title, short_description, controls, genre, engine, tags, mobile, ratio, first_game, age)
  loop
    insert into public.games (
      public_id, owner_id, title, short_description, controls, genre_id, engine_id, tags,
      works_on_mobile, display_ratio, is_first_game, created_at
    )
    select g.public_id, owner.id, g.title, g.short_description, g.controls, g.genre, g.engine, g.tags,
           g.mobile, g.ratio, g.first_game, now() - g.age - interval '1 day'
    from public.profiles owner
    where owner.username = g.owner
    returning id into v_game;

    insert into public.game_versions (
      game_id, number, label, changelog, status, size_bytes, file_count, unpacked_bytes,
      detected_engine, uploaded_at, processed_at
    ) values (
      v_game, 1, 'v1.0', 'Primera versión publicada.', 'ready',
      4000000 + (hashtext(g.public_id) % 3000000 + 3000000) % 3000000,
      40 + (hashtext(g.title) % 60 + 60) % 60,
      12000000 + (hashtext(g.public_id) % 8000000 + 8000000) % 8000000,
      g.engine, now() - g.age - interval '1 hour', now() - g.age - interval '50 minutes'
    ) returning id into v_version;

    update public.games
       set active_version_id = v_version, status = 'published', published_at = now() - g.age
     where id = v_game;
  end loop;

  insert into public.featured_games (week_start, game_id, chosen_by, quote)
  select date_trunc('week', current_date)::date, game.id, admin.id,
         'Un puzzle de gravedad con una idea clarísima. Para ser su primer juego, sorprende.'
  from public.games game, public.profiles admin
  where game.public_id = 'orbita' and admin.username = 'equipo_trafal';
end;
$$;
