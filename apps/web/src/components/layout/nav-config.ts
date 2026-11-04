/** Secciones de la barra principal. `key` es la clave de traducción en el namespace «nav». */
export const NAV_ITEMS = [
  { key: "upload", href: "/games/new" },
  { key: "community", href: "/feed" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
