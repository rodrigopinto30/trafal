import type { LegalContent } from "../types";

export const legalEs: LegalContent = {
  terms: {
    title: "Términos y condiciones",
    summary: "Las reglas para usar Tradfal, en pocas palabras.",
    sections: [
      {
        id: "que-es",
        title: "Qué es Tradfal",
        blocks: [
          "Tradfal es una red social donde cualquiera puede publicar juegos que se juegan en el navegador, mostrar cómo los hace y jugar los de otras personas. Al crear una cuenta aceptás estas reglas, la Política de privacidad, las Normas de la comunidad y la política de Derechos de autor.",
          "Mirar y jugar no requiere cuenta. Publicar, comentar, dar me gusta, guardar, seguir y reportar, sí.",
        ],
      },
      {
        id: "tu-cuenta",
        title: "Tu cuenta",
        blocks: [
          "Tenés que tener {minAge} años o más; lo declarás al registrarte.",
          "Una persona, una cuenta. Sos responsable de lo que se haga con ella: usá una contraseña que no uses en otro lado y no la compartas.",
          "Tu @usuario y tu perfil no pueden hacerse pasar por otra persona, por un estudio ni por el equipo de Tradfal.",
        ],
      },
      {
        id: "tus-juegos",
        title: "Los juegos que publicás",
        blocks: [
          "Tienen que ser tuyos o tenés que tener permiso para usar lo que traen: imágenes, sonidos, música, código y marcas. No se permite:",
          [
            "contenido ilegal, que acose u odie, o sexual explícito;",
            "estafas, ni juegos que pidan contraseñas, datos de tarjetas u otros datos personales;",
            "software malicioso, minería de criptomonedas, rastreo oculto o intentos de salir del marco del juego;",
            "juegos distintos de lo que dice su página.",
          ],
          "Seguís siendo dueño de tu juego. Nos das permiso para alojarlo, revisarlo, mostrarlo y hacerlo funcionar en Tradfal mientras esté publicado. El permiso termina cuando lo bajás o lo borrás, salvo por las copias técnicas, que tardan un tiempo en borrarse.",
          "Cada juego pasa por una revisión automática antes de poder publicarse y se juega aislado, en otro dominio. Pasar la revisión no quiere decir que lo respaldemos: jugar un juego es ejecutar un programa hecho por otra persona.",
        ],
      },
      {
        id: "lo-demas",
        title: "Avances, comentarios y perfil",
        blocks: [
          "Vale lo mismo que para los juegos: lo que publicás es tuyo, nos das permiso para mostrarlo mientras esté publicado y tiene que cumplir las Normas de la comunidad.",
        ],
      },
      {
        id: "moderacion",
        title: "Moderación",
        blocks: [
          "Podemos ocultar juegos, avances o comentarios que rompan estas reglas o pongan en riesgo la plataforma, y suspender o cerrar cuentas. Siempre avisamos el motivo.",
          "Si creés que nos equivocamos, podés apelar desde Configuración → Moderación, una vez por decisión.",
        ],
      },
      {
        id: "limites",
        title: "Límites",
        blocks: [
          "Para cuidar el espacio y el servicio hay topes: cuánto puede pesar un juego, cuántas imágenes lleva, cuántas veces por día se puede subir, comentar o publicar. Los de hoy están en la guía «Cómo subir un juego» y pueden cambiar.",
          "No se vale saltearlos: nada de automatizar el sitio, inflar contadores ni crear cuentas en masa.",
        ],
      },
      {
        id: "baja",
        title: "Cerrar tu cuenta",
        blocks: [
          "Podés eliminar tu cuenta cuando quieras desde Configuración → Cuenta. Se borran tu perfil, tus juegos, tus avances, tus comentarios y tus archivos, y no se puede deshacer. El registro de moderación y los reclamos de derechos de autor se conservan, sin tu cuenta.",
        ],
      },
      {
        id: "sin-garantias",
        title: "Sin garantías",
        blocks: [
          "Tradfal se ofrece tal como está: puede haber cortes, errores, cambios o pérdida de datos, y no garantizamos que los juegos de otras personas funcionen en tu dispositivo. Guardá una copia de lo que te importe.",
          "En la medida en que lo permita la ley, no respondemos por daños indirectos ni por lo que otras personas publiquen o hagan. Nada de esto limita los derechos que la ley te da como persona consumidora.",
        ],
      },
      {
        id: "cambios",
        title: "Cambios",
        blocks: [
          "Podemos actualizar estas reglas; la fecha de arriba indica la última versión. Si el cambio es importante, te avisamos en el sitio y, si hace falta, te pedimos que lo aceptes de nuevo.",
        ],
      },
      {
        id: "contacto",
        title: "Contacto",
        blocks: [
          "Para reportar algo, usá el botón «Reportar». Para una decisión de moderación, Configuración → Moderación. Para derechos de autor, el formulario de reclamos.",
          "También podés escribirnos a {email}.",
        ],
      },
    ],
  },
  privacy: {
    title: "Política de privacidad",
    summary: "Qué datos guardamos, para qué y cómo los controlás.",
    sections: [
      {
        id: "responsable",
        title: "Quién cuida tus datos",
        blocks: [
          "Tus datos los trata el equipo que opera Tradfal. Pedimos pocos a propósito: no pedimos fecha de nacimiento, teléfono ni documento.",
          "Por cualquier consulta sobre tus datos, escribinos a {email}.",
        ],
      },
      {
        id: "que-datos",
        title: "Qué datos guardamos",
        blocks: [
          [
            "Tu cuenta: tu email y tu contraseña, que guarda cifrada el servicio de autenticación (nunca la vemos). Si entrás con Google o con Discord, recibimos lo básico para identificarte, como tu email y tu nombre.",
            "Lo que aceptaste: la versión de los términos, cuándo la aceptaste y cuándo confirmaste que tenés {minAge} años o más.",
            "Tu perfil, que es público: @usuario, nombre, bio, ciudad, país, foto y géneros favoritos.",
            "Lo que publicás, que es público salvo los borradores: juegos con su portada y sus versiones, avances con sus imágenes o videos, y comentarios.",
            "Lo que hacés en el sitio: me gusta, guardados, a quién seguís, tus reportes, tus avisos y tu idioma.",
            "Partidas: el juego y la versión, el tipo de dispositivo, un identificador de la visita y los segundos jugados; si tenías sesión, tu cuenta. No guardamos tu dirección IP.",
            "Para frenar abusos: cuándo hiciste ciertas acciones (para los topes de uso) y el resultado del captcha.",
            "Moderación y reclamos: el motivo y el registro de cada decisión, y los datos de quien envía un reclamo de derechos de autor.",
          ],
          "Nuestros proveedores pueden registrar direcciones IP y datos técnicos del navegador por seguridad.",
        ],
      },
      {
        id: "para-que",
        title: "Para qué los usamos",
        blocks: [
          [
            "Darte la cuenta y el servicio, y avisarte de lo que pasa con tu contenido.",
            "Mostrar estadísticas a quien hizo un juego, por ejemplo cuántas partidas tuvo.",
            "Cuidar el sitio: moderar, frenar abusos y cumplir la ley.",
            "No hay publicidad, no armamos perfiles para vender y no vendemos tus datos.",
          ],
        ],
      },
      {
        id: "proveedores",
        title: "Con quién se comparten",
        blocks: [
          "Solo con los servicios que hacen funcionar Tradfal:",
          [
            "Supabase: base de datos y autenticación.",
            "Cloudflare: almacenamiento de archivos y captcha (Turnstile, que puede mirar datos del navegador para distinguir personas de programas).",
            "Google o Discord, solo si entrás con alguno de ellos.",
            "El servicio que aloja el sitio y el que manda los emails.",
          ],
          "Tu perfil y lo que publicás son públicos, también para los buscadores. Podemos compartir datos si lo pide una autoridad competente, para proteger a alguien o, en un reclamo de derechos de autor, lo necesario para resolverlo. Algunos proveedores están en otros países.",
        ],
      },
      {
        id: "cookies",
        title: "Cookies y almacenamiento",
        blocks: [
          "Solo lo necesario: la cookie de tu sesión, una cookie con tu idioma (dura un año) y, en tu navegador, si silenciaste los juegos o pausaste los GIF. No hay cookies de publicidad ni analítica de terceros.",
          "Los juegos corren en otro dominio y cada uno tiene su propio almacenamiento; lo que guarden, como tu progreso, lo decide cada juego.",
        ],
      },
      {
        id: "cuanto-tiempo",
        title: "Cuánto tiempo los guardamos",
        blocks: [
          "Mientras tengas la cuenta. Si la eliminás, se borra todo lo tuyo; se conservan, sin tu cuenta, el registro de moderación y los reclamos de derechos de autor. Las copias de seguridad de los proveedores tardan un tiempo en renovarse.",
        ],
      },
      {
        id: "tus-derechos",
        title: "Tus derechos",
        blocks: [
          "Podés acceder a tus datos, corregirlos, borrarlos u oponerte a un uso:",
          [
            "Corregir: Configuración → Perfil.",
            "Borrar todo: Configuración → Cuenta.",
            "Acceder o pedir una copia: escribinos a {email}.",
          ],
          "Si creés que no tratamos bien tus datos, podés reclamar ante la autoridad de protección de datos de tu país; en la Argentina, la Agencia de Acceso a la Información Pública.",
        ],
      },
      {
        id: "menores",
        title: "Menores",
        blocks: ["Tradfal es para personas de {minAge} años o más. Si detectamos una cuenta de alguien menor, la cerramos y borramos sus datos."],
      },
      {
        id: "seguridad",
        title: "Seguridad",
        blocks: [
          "Protegemos los datos con permisos por cuenta en la base de datos, conexiones cifradas, contraseñas cifradas y la revisión de todo lo que se sube. Ningún sistema es infalible: si una falla te afecta, te avisamos.",
        ],
      },
      {
        id: "cambios",
        title: "Cambios",
        blocks: ["Podemos actualizar esta política; la fecha de arriba indica la última versión y, si el cambio es importante, te avisamos."],
      },
    ],
  },
  guidelines: {
    title: "Normas de la comunidad",
    summary: "Cómo nos tratamos en Tradfal y qué pasa si alguien no cumple.",
    sections: [
      {
        id: "la-idea",
        title: "La idea",
        blocks: [
          "Tradfal es para mostrar lo que hacés, aprender y jugar cosas nuevas, y funciona con respeto y ganas de ayudar. Estas normas son lo básico: el equipo puede actuar ante algo dañino aunque no esté escrito acá.",
        ],
      },
      {
        id: "respeto",
        title: "Respeto",
        blocks: [
          "Criticá el juego, no a quien lo hizo. No se permite:",
          [
            "acoso, amenazas o insultos, dentro y fuera del sitio;",
            "odio o discriminación por origen, género, orientación, religión, discapacidad u otra condición;",
            "publicar datos personales de otras personas;",
            "hacerse pasar por otra persona, por un estudio o por el equipo de Tradfal.",
          ],
        ],
      },
      {
        id: "que-no-se-publica",
        title: "Contenido",
        blocks: [
          "No se permite publicar:",
          [
            "nada ilegal, ni violencia real o daño a personas o animales;",
            "contenido sexual explícito, y nunca nada que involucre a menores;",
            "violencia gráfica extrema fuera de un contexto claro de juego;",
            "spam, estafas o enlaces a sitios dañinos;",
            "obras ajenas sin permiso (ver Derechos de autor).",
          ],
          "Si tu juego tiene temas fuertes, avisalo en la descripción.",
        ],
      },
      {
        id: "juegos-honestos",
        title: "Juegos honestos",
        blocks: [
          [
            "Que la descripción, la portada y el género digan la verdad.",
            "Que el juego no pida contraseñas, tarjetas ni datos personales.",
            "Nada de software malicioso, minería de criptomonedas, rastreo oculto ni intentos de salir del marco.",
            "Contá cómo se juega y si tiene sonido.",
          ],
        ],
      },
      {
        id: "feedback",
        title: "Comentar y dar feedback",
        blocks: [
          "Un buen comentario es concreto: qué te gustó, dónde te trabaste, qué sugerís. Respondé las preguntas del creador y, si el juego es tuyo, marcá «Me sirvió» en lo que de verdad te ayudó.",
        ],
      },
      {
        id: "juego-limpio",
        title: "Juego limpio",
        blocks: ["No infles partidas, me gusta ni seguidores con cuentas falsas o programas, y no intentes saltear los topes de uso ni el captcha."],
      },
      {
        id: "si-alguien-no-cumple",
        title: "Si alguien no cumple",
        blocks: [
          "Usá el botón «Reportar»: lo revisa una persona del equipo.",
          [
            "Podemos ocultar un juego, un avance o un comentario, siempre avisando el motivo; se puede revertir.",
            "Podemos suspender una cuenta, con o sin fecha de fin, o cerrarla en casos graves o repetidos.",
            "Cada decisión queda en un registro que nadie puede editar ni borrar.",
          ],
          "Si creés que nos equivocamos, apelá desde Configuración → Moderación, una vez por decisión.",
          "También podés escribirnos a {email}.",
        ],
      },
    ],
  },
  copyright: {
    title: "Derechos de autor",
    summary: "Cómo reclamar si algo publicado en Tradfal usa tu obra sin permiso.",
    sections: [
      {
        id: "la-regla",
        title: "La regla",
        blocks: [
          "Solo se puede publicar lo que es tuyo o lo que tenés permiso para usar. Si algo en Tradfal usa tu obra sin permiso, reclamalo con el formulario de esta página. No hace falta tener cuenta: puede hacerlo quien tiene los derechos o alguien autorizado.",
        ],
      },
      {
        id: "que-pide",
        title: "Qué pide el reclamo",
        blocks: [
          [
            "Tu nombre y un email de contacto, y la organización si reclamás por una.",
            "Qué obra es tuya y, si existe, dónde está publicada la original.",
            "Las direcciones del juego o del avance en Tradfal.",
            "Que declares de buena fe que ese uso no está autorizado y que lo que informás es exacto.",
            "Tu firma: tu nombre completo.",
          ],
        ],
      },
      {
        id: "que-pasa",
        title: "Qué pasa después",
        blocks: [
          [
            "Una persona del equipo lo revisa.",
            "Si corresponde, ocultamos el contenido; se puede volver a publicar si fue un error.",
            "Quien lo publicó recibe un aviso con el motivo.",
            "Todo queda en un registro que no se puede editar ni borrar.",
          ],
          "No hay un plazo fijo, pero cada reclamo lo mira una persona. Tus datos se usan solo para el reclamo, y podemos pasarle a la otra parte lo necesario para resolverlo.",
        ],
      },
      {
        id: "si-reclamaron-tu-contenido",
        title: "Si reclamaron tu contenido",
        blocks: [
          "Si creés que fue un error (tenés permiso o la obra es tuya), respondé con una contranotificación desde Configuración → Moderación: explicás por qué, con tu nombre completo y un email, y declarás que es cierto. Una persona del equipo la compara con el reclamo y te responde por escrito.",
          "Para que las partes puedan hablar, podemos pasarle tu nombre y tu email a quien reclamó; sus datos no te los damos nosotros.",
          "También podés escribirnos a {email} con las pruebas.",
        ],
      },
      {
        id: "abusos",
        title: "Reclamos falsos y reincidencia",
        blocks: [
          "Un reclamo falso o de mala fe se rechaza y puede tener consecuencias legales. El formulario tiene un tope de envíos y un captcha. Quien publique obras ajenas una y otra vez puede perder su cuenta.",
        ],
      },
    ],
  },
};
