/**
 * Versión vigente de los Términos y la Política de privacidad. Se guarda junto con la fecha de aceptación
 * (profile_private.terms_version). Si cambian los textos, se actualiza acá y se vuelve a pedir la aceptación.
 *
 * 2026-11-04: la edad mínima pasó de 13 a 18 años.
 * 2026-11-10: los documentos legales pasaron de «en redacción» a su primer texto completo (borrador).
 */
export const TERMS_VERSION = "2026-11-10";

/**
 * Edad mínima para crear una cuenta. Se pide como DECLARACIÓN (casilla «tengo 18 años o más»): no se pide la fecha de
 * nacimiento para recolectar menos datos personales. La base guarda cuándo se confirmó (profile_private.age_confirmed_at).
 */
export const MIN_AGE = 18;
