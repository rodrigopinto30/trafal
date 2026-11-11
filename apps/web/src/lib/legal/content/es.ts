import type { LegalContent } from "../types";

export const legalEs: LegalContent = {
  terms: {
    title: "Términos y condiciones",
    summary: "Las reglas para usar Trafal: tu cuenta, lo que publicás, lo que podemos hacer si algo sale mal y lo que no garantizamos.",
    sections: [
      {
        id: "quienes-somos",
        title: "Quiénes somos y qué es Trafal",
        blocks: [
          "Trafal es una red social para quienes hacen videojuegos que se juegan en el navegador: sirve para publicarlos, mostrar avances, recibir comentarios y descubrir juegos de otras personas. El sitio lo opera {operator} («nosotros»).",
          "Podés escribirnos a {email}.",
        ],
      },
      {
        id: "aceptacion",
        title: "Aceptación y edad mínima",
        blocks: [
          "Al crear una cuenta o usar Trafal aceptás estos términos, la Política de privacidad, las Normas de la comunidad y la política de Derechos de autor. Si no estás de acuerdo, no uses el sitio.",
          "Tenés que tener {minAge} años o más. Al registrarte lo declarás con una casilla y guardamos la fecha en que lo hiciste y la versión de los términos que aceptaste. Si sabemos que alguien no cumple la edad mínima, podemos cerrar su cuenta.",
          "Mirar el sitio, jugar y leer no requiere cuenta. Publicar, comentar, reaccionar, reportar y seguir a otras personas, sí.",
        ],
      },
      {
        id: "cuenta",
        title: "Tu cuenta",
        blocks: [
          "Sos responsable de lo que se hace con tu cuenta. Elegí una contraseña que no uses en otro lado y no la compartas. Si creés que alguien entró a tu cuenta, avisanos.",
          "Tu @usuario tiene que ser tuyo: no se puede suplantar a otra persona, a un estudio ni al equipo de Trafal, y algunos nombres están reservados. Los datos de tu perfil tienen que ser verdaderos en lo que importa: no te hagas pasar por quien no sos.",
          "Una persona, una cuenta. No vendas ni cedas tu cuenta.",
        ],
      },
      {
        id: "tu-contenido",
        title: "Lo que publicás y la licencia que nos das",
        blocks: [
          "Lo que publicás (juegos, avances, imágenes, videos, comentarios, tu perfil) es tuyo. No te pedimos que nos lo cedas.",
          "Para poder mostrarlo, nos das una licencia no exclusiva, gratuita y válida en todo el mundo para:",
          [
            "alojar, copiar y procesar tu contenido (por ejemplo, revisar un archivo, generar miniaturas o tarjetas para compartir);",
            "mostrarlo y ejecutarlo dentro de Trafal, y permitir que otras personas lo vean, jueguen tu juego y lo compartan con un enlace;",
            "guardar copias técnicas de seguridad el tiempo razonable que lleve borrarlas.",
          ],
          "La licencia termina cuando borrás el contenido o tu cuenta, salvo por esas copias técnicas y por lo que otras personas ya hayan citado o compartido por su cuenta fuera de Trafal.",
          "Declarás que tenés derecho a publicar lo que subís: que lo hiciste vos, o que tenés permiso de quien corresponde. Si usás arte, música, código o marcas de otras personas, el permiso es tuyo de conseguir.",
        ],
      },
      {
        id: "juegos",
        title: "Los juegos",
        blocks: [
          "Cada juego se juega dentro de un marco aislado y en un dominio distinto al de Trafal, para que no pueda leer tu sesión ni tus datos del sitio. Aun así, jugar un juego es ejecutar un programa hecho por otra persona: lo hacés bajo tu propia responsabilidad.",
          "Los juegos pasan por una revisión automática antes de publicarse (formato, tamaño y contenido del archivo). Pasarla no significa que lo revisemos ni que lo respaldemos: la revisión no detecta todo.",
          "Un juego no puede:",
          [
            "intentar salir del marco, leer o modificar el sitio, robar datos o sesiones;",
            "contener software malicioso, minería de criptomonedas ni rastreo oculto de las personas que juegan;",
            "pedir datos personales o pagos de una manera engañosa;",
            "ser distinto de lo que se describe en su página.",
          ],
          "Un juego puede guardar datos en tu navegador (por ejemplo, tu progreso). Eso lo decide el juego, no Trafal.",
        ],
      },
      {
        id: "conducta",
        title: "Conducta",
        blocks: [
          "Tenés que cumplir las Normas de la comunidad. No uses Trafal para nada ilegal, para acosar, para engañar ni para dañar el servicio o a otras personas.",
          "Tampoco se puede automatizar el uso del sitio para evitar los límites, inflar contadores (partidas, me gusta, seguidores), crear cuentas en masa o saltearse el captcha.",
        ],
      },
      {
        id: "moderacion",
        title: "Moderación, suspensiones y registro",
        blocks: [
          "Cualquier persona con cuenta puede reportar contenido. Lo revisa el equipo de administración, que puede ocultar un juego, un avance o un comentario si no cumple estas reglas, y volver a publicarlo si fue un error.",
          "Cuando ocultamos algo o suspendemos una cuenta, avisamos a la persona y le decimos el motivo. Una cuenta suspendida puede entrar y mirar, pero no publicar, comentar, reaccionar, reportar ni seguir; la suspensión puede tener una fecha de fin.",
          "Cada acción de moderación queda en un registro interno que no se puede editar ni borrar, con quién actuó, sobre qué y por qué.",
          "Si creés que nos equivocamos, podés apelar la decisión desde Configuración → Moderación: un administrador la analiza, te responde y, si te da la razón, la revierte (se levanta la suspensión o se vuelve a publicar lo oculto). Cada decisión se puede apelar una vez. También podés escribirnos a {email}.",
        ],
      },
      {
        id: "derechos-de-autor",
        title: "Derechos de autor",
        blocks: [
          "Respetamos los derechos de autor y esperamos lo mismo de quienes publican. Si algo que está en Trafal es tuyo y no diste permiso, podés enviarnos un reclamo con el formulario de la página de Derechos de autor. Quien publica contenido ajeno sin permiso puede ver su contenido oculto y, si se repite, su cuenta suspendida.",
        ],
      },
      {
        id: "limites",
        title: "Límites de uso",
        blocks: [
          "Para cuidar el servicio hay topes sobre cuántas veces podés realizar ciertas acciones en un período (por ejemplo, comentar, publicar, subir versiones de un juego, reportar o enviar reclamos). Si llegás al tope, tenés que esperar. Los topes pueden cambiar.",
          "Algunos formularios usan un captcha para comprobar que quien escribe es una persona.",
        ],
      },
      {
        id: "baja",
        title: "Cerrar tu cuenta y qué podemos hacer nosotros",
        blocks: [
          "Podés eliminar tu cuenta cuando quieras desde Configuración → Cuenta. Se borran tu perfil, tus juegos, tus avances, tus comentarios y tus archivos; no se puede deshacer. Se conservan el registro de moderación y los reclamos de derechos de autor sobre tu contenido, sin tu cuenta.",
          "Podemos suspender o cerrar una cuenta, o quitar contenido, si incumplís estos términos o las normas, si lo exige la ley o si ponés en riesgo a otras personas o al servicio. Cuando sea posible, te avisamos antes y te decimos por qué.",
          "Podemos modificar o dejar de ofrecer partes del servicio. Si es algo importante, lo avisamos con tiempo razonable.",
        ],
      },
      {
        id: "garantias",
        title: "Sin garantías",
        blocks: [
          "Trafal se ofrece «tal cual». No garantizamos que funcione sin interrupciones o errores, que los juegos de otras personas sean seguros o funcionen en tu dispositivo, ni que el contenido sea exacto. Hacemos copias de seguridad, pero no te prometemos que nada se vaya a conservar para siempre: guardá una copia de lo que te importe.",
        ],
      },
      {
        id: "responsabilidad",
        title: "Límite de responsabilidad",
        blocks: [
          "En la medida máxima que permita la ley, no somos responsables por daños indirectos, pérdida de datos o de oportunidades, ni por lo que otras personas publiquen o hagan, incluidos los juegos que ejecutes. Nada de lo que decimos acá limita derechos que la ley no permita limitar, por ejemplo los de las personas consumidoras.",
        ],
      },
      {
        id: "cambios",
        title: "Cambios en estos términos",
        blocks: [
          "Podemos actualizar estos términos. La fecha de arriba indica la última versión. Si el cambio es importante, te lo avisamos en el sitio o por email y, cuando corresponda, te pedimos que lo aceptes de nuevo. Seguir usando Trafal después de un cambio significa que lo aceptás.",
        ],
      },
      {
        id: "ley-aplicable",
        title: "Ley aplicable y contacto",
        blocks: [
          "Estos términos se rigen por las leyes de {jurisdiction}. Ante un conflicto, intentamos resolverlo primero hablando; si no se puede, corresponde a los tribunales de {jurisdiction}, sin perjuicio de los derechos que la ley te reconozca como persona consumidora.",
          "Para cualquier consulta: {email}.",
        ],
      },
    ],
  },
  privacy: {
    title: "Política de privacidad",
    summary: "Qué datos guardamos, para qué, con quién los compartimos y cómo podés controlarlos o borrarlos.",
    sections: [
      {
        id: "responsable",
        title: "Quién es responsable de tus datos",
        blocks: [
          "El responsable del tratamiento es {operator}. Para cualquier consulta sobre tus datos escribinos a {email}.",
          "Pedimos pocos datos a propósito: no pedimos fecha de nacimiento, teléfono ni documento.",
        ],
      },
      {
        id: "que-datos",
        title: "Qué datos guardamos",
        blocks: [
          [
            "Cuenta: tu email y tu contraseña (la guarda el servicio de autenticación de forma cifrada; nosotros nunca la vemos). Si entrás con Google, recibimos el dato básico de esa cuenta que hace falta para identificarte, como tu email.",
            "Consentimiento: la versión de los términos que aceptaste, cuándo la aceptaste y cuándo confirmaste que tenés {minAge} años o más.",
            "Perfil (lo completás vos): @usuario, nombre, bio, ciudad, país, foto, motores y géneros favoritos. Tu perfil es público: se ve sin iniciar sesión.",
            "Lo que publicás: juegos (con sus versiones, portadas y capturas), avances con sus imágenes o videos, y comentarios. Es público, salvo lo que esté en borrador.",
            "Lo que hacés en el sitio: me gusta, guardados, a quién seguís y quién te sigue, tus reportes, tus avisos (notificaciones) y tu idioma preferido.",
            "Partidas: cuando alguien juega un juego guardamos el juego y la versión, el tipo de dispositivo (escritorio, celular o tableta), un identificador de la sesión de la página y los segundos de juego activo. Si tenías sesión iniciada, queda ligada a tu cuenta. No guardamos tu dirección IP en esos datos.",
            "Control de abuso: un registro de qué acciones hiciste y cuándo, para aplicar los topes de uso, y el resultado del captcha en los formularios que lo usan.",
            "Moderación: si se actuó sobre tu cuenta o tu contenido, el motivo y el registro de esa acción.",
            "Reclamos de derechos de autor: quien envía uno nos da su nombre, email, organización (si hay), la descripción de la obra y las direcciones involucradas.",
          ],
          "Como cualquier servicio en internet, nuestros proveedores pueden registrar direcciones IP y datos técnicos del navegador en sus registros de seguridad y funcionamiento.",
        ],
      },
      {
        id: "para-que",
        title: "Para qué los usamos",
        blocks: [
          [
            "Darte la cuenta y el servicio: iniciar sesión, mostrar tu perfil, publicar, comentar y avisarte de lo que pasa con tu contenido.",
            "Mostrar estadísticas a quienes crean juegos (por ejemplo, cuántas partidas tuvo un juego).",
            "Mantener el sitio seguro: aplicar las normas, moderar, frenar abusos y spam, y cumplir lo que exige la ley.",
            "No hacemos publicidad, no armamos perfiles para vender y no vendemos tus datos.",
          ],
        ],
      },
      {
        id: "con-quien",
        title: "Con quién los compartimos",
        blocks: [
          "Usamos proveedores que tratan datos en nuestro nombre y solo para dar el servicio:",
          [
            "Supabase: base de datos y autenticación.",
            "Cloudflare: almacenamiento de archivos (R2) y el captcha (Turnstile). Turnstile puede usar datos del navegador para distinguir personas de programas.",
            "Google, solo si elegís entrar con tu cuenta de Google.",
            "El proveedor que aloja el sitio y el que envía los emails de confirmación y de recuperación de contraseña.",
          ],
          "Lo que publicás y tu perfil son públicos y los puede ver cualquiera, incluidos buscadores. Podemos compartir datos si lo exige una autoridad con competencia, o si hace falta para proteger a las personas o el servicio. En un reclamo de derechos de autor, podemos compartir con la otra parte lo necesario para resolverlo.",
          "Algunos proveedores pueden estar en otros países, que pueden tener reglas de protección de datos distintas a las del tuyo.",
        ],
      },
      {
        id: "cookies",
        title: "Cookies y almacenamiento local",
        blocks: [
          "Usamos solo lo necesario para que el sitio funcione: la cookie de tu sesión cuando iniciás sesión y una cookie con tu idioma (dura un año). No usamos cookies de publicidad ni herramientas de analítica de terceros.",
          "Los juegos se ejecutan en otro dominio y cada uno tiene su propio almacenamiento aislado. Lo que un juego guarde en tu navegador lo decide ese juego.",
        ],
      },
      {
        id: "cuanto-tiempo",
        title: "Cuánto tiempo los guardamos",
        blocks: [
          "Guardamos tus datos mientras tengas la cuenta. Cuando la eliminás, borramos tu perfil, tu inicio de sesión, tus juegos, avances, comentarios, reacciones, guardados, seguidos, avisos y tus archivos.",
          "Conservamos, sin tu cuenta: el registro de moderación (para rendir cuentas de lo que se hizo) y los reclamos de derechos de autor sobre tu contenido. Las copias de seguridad de nuestros proveedores pueden tardar un tiempo en rotar.",
        ],
      },
      {
        id: "tus-derechos",
        title: "Tus derechos",
        blocks: [
          "Según la ley que te corresponda, podés acceder a tus datos, corregirlos, pedir que los borremos, oponerte a algún uso y pedir una copia.",
          [
            "Corregir: editá tu perfil en Configuración → Perfil.",
            "Borrar: eliminá tu cuenta en Configuración → Cuenta.",
            "Acceder, pedir una copia o cualquier otro derecho: escribinos a {email}. Todavía no hay una descarga automática de tus datos.",
          ],
          "Si creés que no tratamos bien tus datos, podés reclamar ante la autoridad de protección de datos de tu país.",
        ],
      },
      {
        id: "menores",
        title: "Menores",
        blocks: ["Trafal es solo para personas de {minAge} años o más. No recolectamos datos a sabiendas de quien no cumpla la edad; si lo detectamos, cerramos la cuenta y borramos sus datos."],
      },
      {
        id: "seguridad",
        title: "Seguridad",
        blocks: [
          "Cuidamos tus datos con permisos por cuenta en la base de datos, cifrado en tránsito, contraseñas cifradas y revisión de lo que se sube. Ningún sistema es infalible: si hubiera una brecha que te afecte, te avisaremos como corresponda.",
        ],
      },
      {
        id: "cambios",
        title: "Cambios en esta política",
        blocks: ["Podemos actualizarla. La fecha de arriba indica la última versión; si el cambio es importante, te lo avisamos."],
      },
    ],
  },
  guidelines: {
    title: "Normas de la comunidad",
    summary: "Cómo esperamos que nos tratemos y qué pasa cuando alguien no cumple.",
    sections: [
      {
        id: "espiritu",
        title: "La idea",
        blocks: [
          "Trafal es un lugar para mostrar lo que hacés, aprender de otras personas y jugar cosas nuevas. Una comunidad así funciona cuando hay respeto, honestidad y ganas de ayudar. Estas normas explican lo básico; no son una lista cerrada: la administración puede actuar ante conductas dañinas aunque no estén escritas acá.",
        ],
      },
      {
        id: "respeto",
        title: "Respeto",
        blocks: [
          "Tratá a las demás personas como te gustaría que te traten. Está bien criticar un juego; no está bien atacar a quien lo hizo.",
          "No se permite:",
          [
            "acoso, amenazas, insultos o persecución, dentro y fuera del sitio;",
            "discursos de odio o discriminación por origen, género, orientación, religión, discapacidad u otra condición;",
            "publicar datos personales de otras personas sin su permiso;",
            "hacerse pasar por otra persona, por un estudio o por el equipo de Trafal.",
          ],
        ],
      },
      {
        id: "contenido",
        title: "Contenido",
        blocks: [
          "No se permite publicar:",
          [
            "contenido ilegal, o que muestre o promueva violencia real o daño a personas o animales;",
            "contenido sexual explícito, y en ningún caso el que involucre a menores;",
            "violencia gráfica extrema sin un contexto claro de juego;",
            "spam, publicidad engañosa, esquemas de estafa o enlaces que lleven a sitios dañinos;",
            "contenido que no es tuyo y para el que no tenés permiso (ver Derechos de autor).",
          ],
          "Si tu juego tiene temas fuertes, avisalo claramente en su descripción.",
        ],
      },
      {
        id: "juegos",
        title: "Juegos honestos",
        blocks: [
          [
            "Que la descripción, las capturas y el género digan la verdad sobre el juego.",
            "Nada de software malicioso, minería de criptomonedas, rastreo oculto ni intentos de salir del marco del juego.",
            "Indicá si el juego tiene sonido, cómo se controla y si funciona en celular.",
          ],
        ],
      },
      {
        id: "comentarios",
        title: "Comentar y dar feedback",
        blocks: [
          "Un buen comentario es específico y útil: qué te gustó, qué te trabó, qué sugerís. Usá las etiquetas (Me gustó, Sugerencia…) cuando ayuden.",
          "Respondé a las preguntas que hace el creador, y marcá «Me sirvió» solo en lo que te ayudó de verdad, si el juego es tuyo.",
        ],
      },
      {
        id: "juego-limpio",
        title: "Juego limpio",
        blocks: [
          "No infles contadores (partidas, me gusta, seguidores) con cuentas falsas o programas, no crees cuentas en masa ni intentes saltear los topes de uso o el captcha.",
        ],
      },
      {
        id: "como-se-aplican",
        title: "Cómo se aplican",
        blocks: [
          "Si ves algo que no cumple estas normas, usá el botón «Reportar». Una persona del equipo lo revisa.",
          [
            "Podemos ocultar un juego, un avance o un comentario. Es reversible y siempre se avisa con el motivo.",
            "Podemos suspender una cuenta (con o sin fecha de fin) o cerrarla en casos graves o repetidos.",
            "Todo queda en un registro interno que nadie puede editar ni borrar.",
          ],
          "Si creés que nos equivocamos, apelá desde Configuración → Moderación (una vez por decisión) o escribinos a {email}.",
        ],
      },
    ],
  },
  copyright: {
    title: "Derechos de autor",
    summary: "Cómo reclamar si algo publicado en Trafal usa tu obra sin permiso, y qué pasa después.",
    sections: [
      {
        id: "principio",
        title: "Nuestro principio",
        blocks: [
          "Quienes publican en Trafal tienen que tener derecho a hacerlo. Si creés que algo publicado infringe tus derechos de autor, podés pedirnos que lo revisemos con el formulario de reclamos de esta página.",
        ],
      },
      {
        id: "quien-puede",
        title: "Quién puede reclamar",
        blocks: ["La persona titular de la obra, o quien la representa con autorización. No hace falta tener cuenta de Trafal."],
      },
      {
        id: "que-incluir",
        title: "Qué tiene que incluir el reclamo",
        blocks: [
          [
            "Tu nombre y un email de contacto (y la organización, si reclamás en nombre de una).",
            "Una descripción de la obra que te pertenece y, si existe, una dirección donde está publicada tu versión original.",
            "Las direcciones en Trafal del juego o del avance que creés que la infringe. Tienen que ser de contenido que exista en el sitio.",
            "Una declaración de que de buena fe creés que el uso no está autorizado por el titular, por su representante ni por la ley.",
            "Una declaración de que lo que informás es exacto y de que sos el titular o estás autorizado a actuar en su nombre.",
            "Tu firma (tu nombre completo).",
          ],
        ],
      },
      {
        id: "que-pasa",
        title: "Qué pasa después",
        blocks: [
          [
            "Una persona del equipo toma el reclamo y lo revisa.",
            "Si corresponde, ocultamos el contenido reclamado. Es reversible: queda a salvo y se puede volver a publicar si fue un error.",
            "La persona que publicó el contenido recibe un aviso con el motivo.",
            "Cada decisión queda en un registro interno que no se puede editar ni borrar.",
          ],
          "No podemos prometer un plazo, pero cada reclamo lo mira una persona. Tus datos de contacto los usamos solo para tramitar el reclamo y podemos compartir con la otra parte lo necesario para resolverlo.",
        ],
      },
      {
        id: "responder",
        title: "Si tu contenido fue reclamado",
        blocks: [
          "Si creés que tu contenido se ocultó por error, por ejemplo porque tenés permiso o la obra es tuya, escribinos a {email} con las pruebas. Hoy no hay un formulario de contranotificación: lo resolvemos caso por caso.",
        ],
      },
      {
        id: "reclamos-falsos",
        title: "Reclamos falsos y reincidencia",
        blocks: [
          "Enviar un reclamo falso o de mala fe puede tener consecuencias legales para quien lo envía, y lo vamos a rechazar. Para evitar abusos, el formulario tiene un tope de envíos y un captcha.",
          "Quien publica contenido ajeno de forma repetida puede ver su cuenta suspendida o cerrada.",
        ],
      },
    ],
  },
};
