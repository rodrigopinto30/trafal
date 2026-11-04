import { Suspense, type ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";

/**
 * Marco de la configuración: el MISMO ancho (960 px) que el perfil y el resto de las pantallas de la cuenta. Las secciones
 * van en pestañas arriba para que las tarjetas ocupen todo el ancho. El menú lee la ruta, por eso va en un <Suspense> con un
 * marcador del mismo tamaño.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("settings");
  return (
    <div className="mx-auto max-w-[960px] px-5 pt-[clamp(24px,5vw,48px)]">
      <header className="mb-6">
        <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight font-bold text-glow-violet">{t("title")}</h1>
        <p className="mt-1 text-text-2">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton aria-hidden="true" className="h-[54px] w-[330px] max-w-full rounded-full" />}>
        <SettingsNav />
      </Suspense>
      <div className="mt-8">{children}</div>
    </div>
  );
}
