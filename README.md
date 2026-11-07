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
- **Reportar un juego** desde el reproductor (con cuenta): motivo y detalles; el mismo juego no se puede reportar dos veces mientras el primer reporte siga abierto, y el equipo conserva una copia de cómo era el juego al reportarlo.
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
- **Notificaciones** de seguidores, comentarios y me gusta.

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
- **Explorar** con búsqueda de texto (en español e inglés, sin importar las tildes) y filtros por género, motor y «funciona en celular», con orden por recientes, tendencia o más jugados.
- **Sorprendeme**: un juego al azar.
- **Creadores**: una página para descubrir a quienes están empezando.
- **Primer juego de la semana** elegido por el equipo.

### Moderación y confianza

**Próximamente** (el modelo de datos ya está preparado)
- **Reportes** de juegos, avances, comentarios y perfiles, con copia del contenido como evidencia.
- **Reclamos de derechos de autor** con un formulario público.
- **Panel de administración** donde cada acción de moderación queda registrada en un historial que nadie puede editar ni borrar.
- **Suspensiones** temporales o permanentes: una cuenta suspendida no puede escribir.
- **Límites de uso**, captcha en el registro y páginas legales definitivas (Términos, Privacidad, Normas de la comunidad y Derechos de autor).

### Diseño y accesibilidad

**Hoy**
- **Estética oscura con neón moderado e inspiración retro/pixel**: tipografías Oxanium, Space Grotesk y Pixelify Sans, botones en forma de píldora, barra de navegación flotante con borde neón y un fondo con aurora y píxeles flotantes que se apagan en celular y si pedís menos movimiento.
- **Menú superior mínimo**: el nombre de la app, «Subir juego» y «Comunidad», y tu cuenta (Mi perfil, Configuración, Cerrar sesión). En celular se abre con una hamburguesa.
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
