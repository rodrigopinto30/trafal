# Trafal

La red social para quienes hacen videojuegos que se juegan en el navegador. Subís tu juego, mostrás cómo lo hacés con avances (devlogs), y la comunidad lo juega gratis, lo comenta y te da feedback. No es una tienda ni una competencia: es un lugar para quienes están empezando a crear y quieren que alguien juegue lo que hicieron.

Para levantar el proyecto y correr las pruebas: [docs/DESARROLLO.md](docs/DESARROLLO.md).

En esta guía, **Hoy** es lo que ya funciona y **Próximamente** lo que está planificado.

## Qué hace Trafal

### Cuentas y acceso

**Hoy**
- **Crear cuenta con email y contraseña.** La contraseña tiene entre 8 y 72 bytes e incluye letras y números; hay que escribirla dos veces. Es obligatorio tildar «tengo 18 años o más y acepto los Términos y la Política de privacidad». No se pide fecha de nacimiento: queda guardada la versión de los términos aceptada y cuándo se aceptó.
- **Confirmación por email.** Llega un mail bilingüe con un link que funciona aunque lo abras en otro dispositivo o navegador.
- **Entrar con Google** (opcional, se activa al configurar las credenciales).
- **Completar el perfil al entrar por primera vez**: elegís tu @usuario y tu nombre. Quien llega con Google confirma ahí los 18+ y los términos.
- **Iniciar y cerrar sesión**, y **recuperar la contraseña** con un link por mail. La pantalla de recuperación responde igual exista o no la cuenta, para no revelar qué emails están registrados.
- **Pantallas protegidas**: si no tenés sesión te mandan a iniciar sesión y, al entrar, volvés a donde ibas. Solo se aceptan destinos internos del sitio, nunca links a otras páginas. Quien ya tiene sesión no ve el login ni el registro.
- **Errores claros y sin perder lo escrito**: si algo falla, el formulario conserva el email, las contraseñas y la casilla de términos.

### Perfiles

**Hoy**
- **@usuario** de 3 a 30 caracteres con letras, números, punto y guion bajo. **No hace falta ningún número**: si está libre, es tuyo. Podés escribirlo con mayúsculas o acentos y se guarda normalizado («Ñandú» pasa a `nandu`). El punto no puede ir al principio, al final ni repetido.
- **Disponibilidad en vivo** mientras escribís. Si el nombre está ocupado, te sugiere alternativas libres sin números (`_dev`, `_games`, `.codes`…). Hay una lista corta de nombres reservados para que nadie se haga pasar por el equipo. El @usuario no se puede cambiar, así los links nunca se rompen.
- **Datos del perfil**: nombre (hasta 50 caracteres), bio (hasta 280), ciudad, país (lista de 249 países en tu idioma), hasta 8 **motores** que usás (Godot, Unity, GameMaker, Phaser, PICO-8, Scratch, Twine, Construct, Otro) y los **géneros de juegos que te gustan**.
- **Géneros favoritos**: una grilla de 17 géneros con ícono (plataformas, arcade, puzzle, narrativo, roguelike, cozy, terror, ritmo, carreras, aventura, estrategia, disparos, simulación, deportes, lucha, incremental y otro). Tocás uno para elegirlo y lo tocás de nuevo para sacarlo; se muestran en tu perfil.
- **Foto de perfil** que reemplaza la letra de colores. Elegís una imagen (JPG, PNG o WebP, hasta 15 MB), la encuadrás arrastrándola con el dedo o el mouse, o con las flechas del teclado, y hacés zoom. Se guarda cuadrada de 256 px, en WebP (o JPEG si tu navegador no sabe generar WebP). El servidor la vuelve a verificar: formato real, tamaño exacto, que no sea animada y que no traiga datos escondidos. Al cambiarla o quitarla, la anterior se borra. Si no subís foto, tu avatar es tu inicial sobre un degradé único.
- **Página pública del perfil**: avatar, nombre, @usuario, bio, ubicación, motores y géneros; contadores de seguidores, seguidos, juegos y avances; pestañas con **tus juegos** y **tus avances**. Si te falta la foto o los géneros, te aparece un aviso para terminar el perfil.
- **Seguir y dejar de seguir** a otras personas con respuesta inmediata y contador actualizado. Las listas de seguidores y seguidos muestran avatar, nombre y bio. Quien no tiene cuenta, al tocar «Seguir» pasa por el login y vuelve al perfil.

### Avances

**Hoy**
- **Publicar un avance** (botón en tu perfil y en la página de tus juegos): cuatro tipos (**Avance**, **Nuevo juego**, **Pide feedback** y **Hito**, este con un dato destacado de hasta 12 caracteres), texto de hasta 2000 caracteres, un juego tuyo ya publicado (obligatorio para «Nuevo juego») y hasta **4 archivos**: imágenes PNG, JPG o WebP de hasta 5 MB, GIF de hasta 8 MB y videos MP4 de hasta 20 MB, cada uno con una descripción para quien no puede verlo.
- **El servidor no se fía de los archivos**: lee el formato real de los bytes (no el nombre ni el tipo declarado), rechaza lo que no sea exactamente un archivo bien formado (nada pegado atrás), las imágenes animadas que no sean GIF y las dimensiones desmedidas, y **saca los datos de la foto** (EXIF y XMP de los JPEG, como la ubicación GPS). Si algo falla a mitad de camino, no queda nada publicado.
- **Editar todo lo propio**: desde el menú del avance se abre una pantalla con el mismo formulario donde cambia **el tipo, el juego, el texto, el dato destacado y los archivos** (quitar, agregar, reordenar con flechas y cambiar la descripción). Se guarda todo junto o nada: si algo falla, el avance queda como estaba. **Borrar** elimina el avance con sus me gusta, comentarios y archivos. Nadie más ve esas opciones, y la base tampoco se lo permite.
- Los avances se ven en el perfil, en la página del juego y en «Guardados», con sus imágenes, GIF y videos (los videos no se descargan hasta que apretás play).

### Comentarios

**Hoy**
- **Comentar un juego** (sección «Comentarios» de su página) y **un avance** (cada avance tiene su propia página, `/posts/<id>`, a la que lleva su contador de comentarios). Hasta 1000 caracteres y una etiqueta opcional: **Me gustó** o **Sugerencia**.
- **Responder** a un comentario, en **un solo nivel** (no se responde a una respuesta) y sin etiqueta. Quien no tiene cuenta ve la invitación a iniciar sesión y vuelve al mismo lugar.
- **Editar y borrar lo propio**: el texto y la etiqueta se pueden cambiar mientras el comentario esté publicado (si moderación lo oculta, deja de poder tocarlo), y se puede borrar con sus respuestas. Nadie edita ni borra comentarios ajenos; la base tampoco se lo permite.
- Los contadores de comentarios de juegos y avances son los reales (los mantiene la base).

### Rendimiento

**Hoy**
- Se **mide** con Lighthouse sobre la versión de producción (`tools/lighthouse.sh`): en celular, la portada y la página de un juego dan **93 y 87** de rendimiento (el mínimo exigido es 85); en escritorio, 95–100; accesibilidad y SEO, 100, y sin saltos de diseño (CLS 0). Para lograrlo, el navegador descarga menos: ni Zod ni el cliente de base de datos viajan en las páginas públicas, y cada pantalla recibe solo los textos que usa.

### Buscadores y redes sociales

**Hoy**
- **Cada página dice quién es**: título, descripción, **dirección canónica** (siempre la limpia: una vista filtrada de Explorar, Comunidad o Creadores apunta a la base y pide no figurar), **su versión en el otro idioma** (`hreflang`, con el español como predeterminado) y las tarjetas de **Open Graph** y de **Twitter**. Las pantallas de acceso, las listas de seguidores y las páginas que no existen piden no figurar.
- **Imagen para compartir** en la portada, en cada juego, en cada perfil y en cada avance (1200 × 630, con los colores de Trafal, el nombre, quién lo hizo y, en los juegos, «Jugá gratis en el navegador»), en el idioma de la página. Lo que escribe una persona solo se dibuja como texto, recortado.
- **Datos estructurados** para los buscadores: el sitio con su buscador, cada juego como videojuego (gratis, en el navegador, con quién lo hizo y cuántas partidas lleva), cada perfil como persona y cada avance como publicación. Nada de lo que escribe una persona puede cerrar la etiqueta que los contiene.
- **`robots.txt` y `sitemap.xml`**: el sitemap lista las páginas fijas, todos los juegos publicados, los creadores y los avances, cada uno en los dos idiomas y con sus traducciones. `robots.txt` deja afuera las zonas privadas (cuenta, formularios, administración del juego) y las rutas técnicas. **Un sitio que no es público (localhost, `.local`, `.test`) se cierra por completo**: no se indexa una copia de prueba por error; en producción hay que poner el dominio real en `SITE_URL`.

### Explorar

**Hoy**
- **Explorar** (`/explore`): la búsqueda de texto de siempre más **filtros por género, por motor y «solo los que funcionan en celular»**, y **orden** por más nuevos, **en tendencia** (más partidas en los últimos 7 días; a igual cantidad, más me gusta), más jugados y, cuando buscaste algo, más relevantes. Muestra la cantidad total de juegos que coinciden y pasa de a **24 por página**.
- Todo queda en la dirección (`/explore?q=…&genre=…&engine=…&mobile=1&sort=…&page=…`): se puede compartir y funciona el botón de atrás. Los enlaces salen cortos (sin parámetros vacíos ni por defecto), cambiar un filtro vuelve a la primera página, buscar otro texto **conserva los filtros** y cualquier valor raro en la dirección se ignora.
- Solo aparecen juegos publicados: la base lo garantiza, también para quien tiene cuenta.

- **Sorprendeme**: un botón (en la portada, en Explorar y en la página de cada juego) que te lleva a un **juego publicado al azar**, con la misma chance para todos (sin favorecer a los más jugados) y sin repetir el juego en el que estás. Es un enlace común: funciona sin JavaScript y cada vez elige de nuevo.

### Primer juego de la semana

**Hoy**
- **El primer juego de la semana** (el banner grande de la portada, con una frase) lo **elige el equipo**: solo un administrador, solo entre los juegos **publicados** que su creador marcó como **primer juego**, y cada juego puede ser el de la semana **una sola vez**. Se puede dejar elegido con hasta 8 semanas de anticipación (no se muestra hasta que empieza su semana) y volver a elegir la misma semana lo reemplaza. Si una semana no tiene elegido, la portada muestra el último.
- Cada elección o cambio **queda en el registro de moderación**, que solo se agrega (nadie lo edita ni lo borra, ni siquiera un administrador): quién, qué y cuándo.
- Se elige desde **Administración → Juego de la semana** (o con `tools/featured-game.sh`, ver abajo).

### Administración

**Hoy**
- Los administradores ven **Administración** en el menú de la cuenta (`/admin`). Para cualquier otra persona esa dirección no existe, y no figura en los buscadores.
- **Reportes**: una cola con cada reporte y su evidencia (qué se reportó tal como estaba al reportar, el motivo, lo que escribió quien reportó, el estado actual del contenido y un enlace). Se filtra por abiertos, en revisión y resueltos. Un administrador puede **tomar** el reporte, **descartarlo**, **marcarlo como resuelto** o **ocultar el contenido y resolver**; un contenido oculto se puede **restaurar**.
- **Solo se modera ocultando o restaurando** (juegos, avances y comentarios): nada se borra ni se edita. Ocultar o restaurar exige un motivo, que lee la autoría del contenido en sus avisos.
- **Registro**: toda acción queda anotada (quién, qué, sobre qué, por qué y cuándo) en un registro que solo se agrega.
- **Juego de la semana**: elegir, ver lo que viene y sacar elecciones.
- **Cuentas**: buscar a una persona (por el comienzo de su @usuario o de una palabra de su nombre) y **suspender** su cuenta por 1, 7, 30 o 90 días o hasta que se la levante, o **levantarle** la suspensión. Siempre con un **motivo** que la persona lee. No se puede suspender a la administración ni a uno mismo. Desde un reporte hay un enlace directo a la cuenta de quien lo hizo.

### Notificaciones

**Hoy**
- Una **campanita** en la barra (solo con cuenta) con cuántos avisos hay sin leer. Se actualiza **sola** mientras la página está abierta: si alguien comenta o te sigue, el número sube al instante.
- La pantalla **Notificaciones** (`/notifications`) lista los avisos, de más nuevo a más viejo (20 por página). Cada uno dice quién, qué y dónde; al abrirlo se marca como leído y lleva a lo que pasó: si es sobre un comentario, **te deja en ese comentario** (lo centra en la pantalla) y lo **resalta unos segundos**. Se puede **marcar como leído**, **quitar**, o **marcar todos como leídos**.
- Se avisa de: un **comentario** en tu juego o avance; una **respuesta** a tu comentario; un **me gusta** en tu juego o avance (una vez por persona); un **seguidor** nuevo (una vez por persona); que el creador marcó tu comentario como **«Me sirvió»** (una vez por comentario); que una **versión** que subiste quedó lista o fue rechazada; y las decisiones de **moderación** sobre tu contenido o tu cuenta (con el motivo).
- Nadie recibe avisos de lo que hace él mismo. Solo dentro del sitio: no se manda nada por email.

### Suspensiones

**Hoy**
- Una cuenta suspendida **puede entrar y mirar**, pero no publicar, comentar, reportar, seguir ni dar me gusta (la base lo impone en cada tabla). En **todas las páginas** ve un aviso con el motivo y hasta cuándo dura.
- Una suspensión con fecha **termina sola** al llegar esa fecha; sin fecha dura hasta que la administración la levanta.
- Suspender y levantar quedan en el registro de moderación, y la persona recibe un aviso (sin saber qué administrador actuó).

### Creadores

**Hoy**
- **Creadores** (`/creators`, abierta a cualquier persona): un directorio de **quienes tienen al menos un juego publicado** (quien solo juega todavía no es creador), con foto, nombre, @usuario, ubicación, bio, motores que usan, cantidad de juegos y de seguidores, y un botón para **seguir** desde la misma tarjeta. Quien no tiene cuenta pasa por el inicio de sesión y vuelve.
- **Buscar** por nombre o @usuario (sin importar tildes ni mayúsculas; cada palabra tiene que empezar una palabra del nombre o del @usuario), **filtrar** por el motor que usan y por el género que les gusta, y **ordenar** por más nuevos (el orden por defecto: Trafal es para quienes recién empiezan), más seguidos o con más juegos. De a 12 por página.
- La vista vive en la dirección (`/creators?q=…&engine=…&genre=…&sort=…&page=…`), con los mismos cuidados que Explorar: enlaces cortos, valores raros ignorados y páginas que no existen explicadas.

### Comunidad y compartir

**Hoy**
- **Comunidad** (`/feed`, abierta a cualquier persona): los avances de la gente que hace juegos, del más nuevo al más viejo, de a 12, con **filtros por tipo** (todo, avances, juegos nuevos, piden feedback, hitos) y «Ver más antiguas». Con cuenta se suma **«A quienes seguís»**, que muestra solo lo de las personas que seguís. La vista vive en la dirección: se puede compartir y funciona el botón de atrás; una dirección con valores raros vuelve al feed completo.
- **Compartir** (en cada avance y en cada juego): abre el menú de compartir del dispositivo si lo tiene y, si no, copia el enlace público (con el idioma que estás leyendo) y lo avisa.
- La portada lleva al feed con «Ver todos los avances».

### Preguntas del creador y «Me sirvió»

**Hoy**
- **Preguntas del creador**: las hasta 3 preguntas que se escriben al subir un juego aparecen en su página, en «Preguntas del creador», cada una con sus respuestas. Cualquier persona con cuenta responde cada pregunta **una sola vez** (y puede editar o borrar su respuesta); el creador no responde las suyas. Las respuestas no se mezclan con los comentarios generales y se les puede responder como a cualquier comentario.
- **«Me sirvió»**: quien creó el juego (o escribió el avance) marca los comentarios y respuestas de otras personas que le ayudaron; se ve una insignia «Le sirvió al creador» y se puede quitar. No se marcan los comentarios propios ni las respuestas a un comentario, y nadie más ve el botón: la base tampoco lo permite.

### Guardados

**Hoy**
- **Guardados** (menú de la cuenta): los juegos y los avances que guardaste, del más reciente al más viejo, solo visibles para vos. Desde ahí se quitan los avances guardados; si un juego o un avance se oculta o se borra, deja de aparecer.

### Configuración

**Hoy**
- Se llega desde el menú de tu cuenta. Tiene dos secciones en pestañas, con el mismo ancho que el perfil:
  - **Perfil**: foto, datos personales, motores y géneros favoritos.
  - **Preferencias**: idioma de la interfaz.

### Idioma

**Hoy**
- La interfaz está en **español rioplatense (con voseo)** y en **inglés**.
- El idioma sale solo del navegador o el sistema; no hay selector a la vista. Con cuenta, lo cambiás en *Configuración → Preferencias*: queda guardado y vale en cualquier dispositivo donde inicies sesión.
- El español no lleva prefijo en la URL y el inglés usa `/en`. Los textos que escriben los creadores (títulos, descripciones, avances) se muestran como los escribieron.

### Juegos

**Hoy**
- **Página de cada juego** (`/games/<id>`), abierta a cualquier persona, sin cuenta:
  - portada, título, creador, etiquetas de género y motor, insignias «Primer juego» y «Funciona en celular», y contadores de partidas, me gusta y comentarios;
  - **me gusta y guardar** (también en cada avance): responden al instante y el contador es el real; quien no tiene cuenta pasa por el login y vuelve al mismo lugar. Los me gusta y los guardados son privados: el público ve solo los contadores;
  - **Sobre este juego** (descripción corta) y **Cómo se juega** (controles), más hasta 8 etiquetas;
  - tarjeta del creador con acceso a su perfil;
  - los **avances** de ese juego y los **comentarios** con sus respuestas;
  - una invitación a crear cuenta para quien no tiene.
- **Jugar en el navegador, sin cuenta** (botón «Jugar gratis» de la página del juego): el juego corre en un marco aislado, con la proporción propia de cada juego (16:9, 4:3, 1:1 o 9:16), y se sirve desde un **dominio distinto al de Trafal** (`<id>.games…`), de modo que no puede leer tu sesión ni tu almacenamiento. El marco no puede navegar la ventana de Trafal, abrir ventanas, enviar formularios ni descargar archivos. Trae **pantalla completa** (con salida en pantalla y, donde el navegador no la permite, un modo que ocupa toda la ventana), **reiniciar**, un aviso de que el juego puede tener sonido y el conteo de partidas, que no guarda IP ni datos del navegador, solo si se jugó desde computadora, celular o tableta.
- **Reportar** un juego (desde el reproductor), un avance, un comentario o un perfil (con cuenta; quien no la tiene es llevado a iniciar sesión y vuelve): motivo y detalles. «No funciona» es solo para juegos. Lo mismo no se puede reportar dos veces mientras el primer reporte siga abierto, solo se reporta lo que está **publicado**, y el equipo conserva una copia de cómo era al reportarlo. No hay botón de reporte en lo propio.
- **Versiones de un juego**: desde la pantalla de estado, el creador sube un `.zip` nuevo con un nombre (v0.2…) y lo que cambió; la nueva versión pasa por la misma revisión y **la gente sigue jugando la actual hasta que el creador elige otra** («Usar esta versión», y también se puede volver a una anterior). Se puede renombrar cualquier versión y editar su registro de cambios. La página pública del juego muestra una sección **Versiones** con las listas, la actual marcada y sus cambios. Hasta 5 subidas por día entre todos tus juegos.
- **Servidor de juegos**: solo responde a `GET` y `HEAD`; entrega siempre la versión activa, con tipo de contenido y codificación correctos y soporte de rangos (audio y video). Cada respuesta lleva una política que deja al juego hablar solo con su propio origen (sin pedidos externos, sin formularios, sin plugins, sin marcos anidados) y solo permite que lo muestre Trafal. Las páginas HTML solo se entregan dentro de un marco: abrir la dirección del juego directamente lleva a su página en Trafal, para que ningún juego pueda hacerse pasar por una página propia. Un juego oculto o dado de baja deja de servirse a los pocos segundos.
- **Portadas**: la imagen que suba el creador o, mientras no haya, un arte generado con el color e ícono de su género.
- **Subir un juego** (`/games/new`, con cuenta): título, descripción corta, género, motor, hasta 8 etiquetas, cómo se juega, proporción de pantalla, «funciona en celular», «es mi primer juego», hasta 3 preguntas para quienes jueguen, portada y hasta 6 capturas (PNG, JPG o WebP de hasta 5 MB; el servidor mira los bytes reales y rechaza imágenes falsas, animadas o fuera de medida). El `.zip` (hasta 200 MB) viaja **directo del navegador a un espacio de cuarentena** con una dirección firmada que vence en una hora, con barra de progreso y la posibilidad de reintentar si se corta. Hasta 5 subidas por día por persona.
- **Revisión automática del `.zip`**: un proceso aparte (el *worker*) toma cada subida, comprueba su tamaño real, la descomprime en una carpeta temporal y la valida: rechaza rutas peligrosas, ejecutables (también los disfrazados con otra extensión), archivos comprimidos adentro, tipos no permitidos, bombas de descompresión y zips sin `index.html`, y marca (sin bloquear) minería, campos de contraseña e intentos de navegar la ventana superior. Detecta el motor (Godot, Unity, GameMaker, Phaser, PICO-8, Scratch, Twine, Construct) y si necesita aislamiento. **Solo si todo pasa** copia los archivos al espacio de juegos, con su tipo de contenido y su codificación (`.wasm.br`, `.gz`), y borra el zip de la cuarentena. Si algo falla por un problema nuestro, lo reintenta hasta 3 veces.
- **Estado del juego** (`/games/<id>/manage`, solo para su dueño): el juego nace como borrador, que solo ve su creador, y cada versión muestra si está subiendo, en revisión, lista o con un error explicado para principiantes («Falta el archivo index.html», «No aceptamos programas ejecutables»…). La página se actualiza sola. Cuando una versión está lista, el creador puede **publicar el juego** o **volver a dejarlo en borrador**. Los juegos sin publicar aparecen en el propio perfil.

**Próximamente**
- **Godot con hilos** (necesita aislamiento entre orígenes) y **vista previa** de un borrador para su creador: el reproductor todavía avisa que no los soporta.
- **Ficha completa**: mostrar en la página del juego las capturas y las preguntas de feedback, enlace externo opcional y más cupos por persona.

### Comunidad

**Hoy**
- **Avances de cuatro tipos**: avance, nuevo juego, pide feedback e hito (con una etiqueta destacada, como «1000 jugadas»). Se ven en la portada, en la página del juego y en el perfil de cada creador.
- **Comentarios** en juegos y avances, con dos etiquetas («Me gustó» y «Sugerencia»), respuestas de un nivel y la marca «Le sirvió al creador».
- **Lo que dice la comunidad**: en la portada se muestran los mensajes de quienes jugaron, con nombre, foto y el juego del que hablan.

**Próximamente**
- **Publicar avances** (hasta 2000 caracteres y hasta 4 imágenes, GIF o videos cortos), **comentar y responder**, contestar las preguntas del creador y marcar qué comentarios te sirvieron.
- **Me gusta** en juegos y avances, **guardar** y **compartir**.
- **Feed** con las novedades de la gente que seguís y filtros por tipo de avance.
- **Notificaciones** (hecho: ver «Notificaciones»); falta el aviso por email, que no se hace (solo dentro del sitio).

### Descubrir juegos

**Hoy**
- **Buscador de juegos** al inicio de la portada, justo debajo del título y antes de todo lo demás. Mientras escribís sugiere hasta 5 juegos (con su portada y su creador); buscás por título, descripción, etiquetas, género, motor o creador, sin importar tildes ni mayúsculas, y escribir solo el comienzo de una palabra alcanza («orb» encuentra «Órbita»). Se maneja con el teclado (flechas, Enter, Escape) y con lector de pantalla. Al enviar lleva a **Explorar** (`/explore?q=…`), que muestra los resultados con las mismas tarjetas, o todos los juegos si el campo está vacío.
- **Portada** pensada para quien llega sin cuenta y puede jugar gratis. De arriba abajo:
  - un **banner grande** del juego más jugado, con botón «Jugar gratis»;
  - **Recién publicados** (8 juegos);
  - **Los más jugados** (8 juegos, numerados);
  - un segundo **banner con el primer juego de la semana** y una frase del equipo;
  - **Lo que dice la comunidad**, con una invitación a crear cuenta para dejar tu mensaje, dar me gusta, seguir a creadores y publicar tus avances;
  - **Primeros juegos**, de gente que acaba de publicar el suyo;
  - **Por género**, con los tres géneros más poblados;
  - **Novedades de los creadores** (6 avances recientes).
- **Tarjetas de juego** con portada, título, descripción, género, motor, creador, partidas y me gusta. Toda la tarjeta lleva a la página del juego. En celular, cada fila se desliza con el dedo.

**Próximamente**

### Moderación y confianza

**Próximamente** (el modelo de datos ya está preparado)
- **Reportes** de juegos, avances, comentarios y perfiles, con copia del contenido como evidencia.
- **Reclamos de derechos de autor** con un formulario público.
- **Panel de administración** donde cada acción de moderación queda registrada en un historial que nadie puede editar ni borrar.
- **Suspensiones** (hecho: ver «Administración» y «Suspensiones»): temporales o hasta que se levanten; una cuenta suspendida no puede escribir. Falta que la persona pueda apelar.
- **Límites de uso**, captcha en el registro y páginas legales definitivas (Términos, Privacidad, Normas de la comunidad y Derechos de autor).

### Diseño y accesibilidad

**Hoy**
- **Estética oscura con neón moderado e inspiración retro/pixel**: tipografías Oxanium, Space Grotesk y Pixelify Sans, botones en forma de píldora, barra de navegación flotante con borde neón y un fondo con aurora y píxeles flotantes que se apagan en celular y si pedís menos movimiento.
- **Menú superior mínimo**: el nombre de la app, «Explorar», «Creadores», «Comunidad» y «Subir juego», y tu cuenta (Mi perfil, Configuración, Cerrar sesión). En celular se abre con una hamburguesa.
- **Cursor propio**: flecha pixelada, y la manita en todo lo que se puede apretar.
- **Hecho para celular primero**, desde pantallas de 360 px, sin scroll horizontal y con botón para volver arriba.
- **Accesible**: contraste de texto de al menos 4,5:1, objetivos táctiles de al menos 44 px, uso completo con teclado, enlace «Saltar al contenido», etiquetas y errores conectados para lectores de pantalla, y una auditoría automática WCAG 2.2 AA sobre las pantallas principales.
- **Los colores tienen un significado fijo**: el lima es solo para acciones de jugar y el coral solo para me gusta y errores.

### Seguridad y privacidad

**Hoy**
- **Los permisos viven en la base de datos**, no solo en la pantalla: nadie puede editar ni borrar contenido ajeno, y los administradores solo actúan mediante funciones que dejan registro.
- **Datos mínimos**: no se pide fecha de nacimiento ni teléfono, y las contraseñas las gestiona un servicio de autenticación que nunca las guarda en texto plano.
- **Todo lo que escribís se limpia y se valida en el servidor**: sin HTML, sin caracteres invisibles que sirvan para falsificar nombres, con límites de longitud.
- **Las imágenes se revisan byte a byte** antes de guardarse y solo se aceptan en tres formatos.
- **Cabeceras de seguridad** en todo el sitio, que además no puede incrustarse en otras páginas.

**Próximamente**
- Los juegos subidos corren en **otro dominio**, dentro de un iframe aislado, sin acceso a cookies ni a datos del sitio principal, y se verifican con un juego malicioso de prueba.

## Tecnologías

- **Interfaz:** Next.js 16 (App Router, Cache Components y Server Actions), React 19, TypeScript estricto, Tailwind CSS 4, shadcn/ui sobre Radix, lucide-react y Sonner.
- **Validación:** Zod 4 en el servidor, con textos propios de internacionalización (español e inglés).
- **Datos y autenticación:** Supabase: PostgreSQL 17 con seguridad por filas (RLS), Auth con email y Google, y Realtime.
- **Almacenamiento de imágenes:** Cloudflare R2 en producción y el almacenamiento S3 de Supabase en local, con el SDK de AWS.
- **Procesamiento de juegos** *(planificado)*: worker en Python, en contenedor y desplegado en Fly.io; servido por un gateway en Cloudflare Workers.
- **Infraestructura:** Docker y Docker Compose; pnpm y Node 24. Despliegue previsto en Vercel y Cloudflare.
- **Calidad:** Vitest, pgTAP, Playwright con axe-core y ESLint.
