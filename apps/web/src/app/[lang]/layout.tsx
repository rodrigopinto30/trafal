import type { Metadata, Viewport } from "next";
import { Oxanium, Pixelify_Sans, Space_Grotesk } from "next/font/google";
import { Background } from "@/components/layout/background";
import { BackToTop } from "@/components/layout/back-to-top";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n/client";
import { locales } from "@/i18n/config";
import { getMessagesFor, pickClientMessages } from "@/i18n/messages";
import { getLocale, getTranslations } from "@/i18n/server";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import "../globals.css";

// Tres familias, todas variables (un solo archivo por familia): Oxanium para títulos, Space Grotesk para
// texto y botones, Pixelify Sans solo para el logo y las etiquetas chicas en mayúsculas.
const oxanium = Oxanium({ subsets: ["latin", "latin-ext"], variable: "--font-oxanium", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-space-grotesk", display: "swap" });
const pixelifySans = Pixelify_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-pixelify-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#07060e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await getLocale();
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: t("defaultTitle"), template: t("titleTemplate") },
    description: t("description"),
    applicationName: t("siteName"),
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("defaultTitle"),
      description: t("description"),
      locale: locale === "es" ? "es_AR" : "en_US",
    },
    alternates: { languages: { es: "/", en: "/en" } },
  };
}

// Con Cache Components cada parámetro raíz tiene que tener al menos un valor conocido al compilar.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  const messages = pickClientMessages(getMessagesFor(locale));

  return (
    // data-scroll-behavior: Next lo exige cuando el CSS usa scroll-behavior: smooth (para no animar el scroll al cambiar de ruta).
    <html lang={locale} data-scroll-behavior="smooth" className={cn("dark", oxanium.variable, spaceGrotesk.variable, pixelifySans.variable)}>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <Background />
          <div className="relative z-10 flex min-h-dvh flex-col">
            <a
              href="#contenido"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-ink"
            >
              {t("skipToContent")}
            </a>
            <SiteNav />
            <main id="contenido" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
          <BackToTop />
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
