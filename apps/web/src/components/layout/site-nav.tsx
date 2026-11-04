import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { MobileAccount, NavUser } from "./nav-user";

/**
 * Barra flotante fija con borde en degradé neón. El caparazón (logo, links, estructura) es estático; solo la
 * zona de la cuenta depende de la sesión y llega por streaming dentro de un <Suspense>.
 */
export async function SiteNav() {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-3 z-40 mx-auto mt-3 w-full max-w-[1200px] px-3">
      <div className="rounded-[20px] bg-nav-border p-px shadow-[0_0_22px_rgb(139_92_255/0.35),0_0_60px_rgb(46_230_255/0.12)]">
        <div className="flex items-center gap-3 rounded-[19px] bg-[rgb(9_8_20/0.9)] py-2 pr-2 pl-3.5 backdrop-blur-md">
          <Link href="/" aria-label={t("home")} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan">
            <Logo />
          </Link>

          {/* El margen separa las dos opciones del logo para que «trafal.» quede solo a la izquierda (48 px desde 768 px de ancho, 56 px en pantallas grandes). */}
          <div className="hidden flex-1 md:ml-6 md:flex lg:ml-8">
            <Suspense fallback={<NavLinksFallback />}>
              <NavLinks />
            </Suspense>
          </div>
          <span className="flex-1 md:hidden" aria-hidden="true" />

          <Suspense fallback={<Skeleton className="h-11 w-28 rounded-full" />}>
            <NavUser />
          </Suspense>

          {/* El menú lee la ruta (para cerrarse al navegar), así que va en un Suspense con un marcador del mismo tamaño. */}
          <Suspense fallback={<span aria-hidden="true" className="size-11 shrink-0 md:hidden" />}>
            <MobileMenu
              accountSlot={
                <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
                  <MobileAccount />
                </Suspense>
              }
            />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

/** Mientras no hay JS: espacio reservado con el mismo tamaño que los links, para que no salte el layout. */
function NavLinksFallback() {
  return (
    <div aria-hidden="true" className="flex items-center gap-1.5">
      <Skeleton className="h-11 w-28" />
      <Skeleton className="h-11 w-28" />
    </div>
  );
}
