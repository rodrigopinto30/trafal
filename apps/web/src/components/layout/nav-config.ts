/** Secciones de la barra principal. `key` es la clave de traducción en el namespace «nav». */
export const NAV_ITEMS = [
  { key: "explore", href: "/explore" },
  { key: "creators", href: "/creators" },
  { key: "community", href: "/feed" },
  { key: "upload", href: "/games/new" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
