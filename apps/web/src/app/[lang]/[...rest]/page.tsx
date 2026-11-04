import { notFound } from "next/navigation";

/**
 * Cualquier URL que no coincide con una página real cae acá y dispara el 404 DENTRO del layout de [lang]:
 * así la página de «no encontrado» lleva la marca, el idioma correcto y la navegación (si no, Next muestra
 * su 404 genérico, sin <html lang>, fuera de nuestro diseño). No lee los parámetros, así que sigue siendo estática.
 */
export default function CatchAllNotFound() {
  notFound();
}
