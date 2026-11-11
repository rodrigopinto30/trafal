import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");

  const columns = [
    {
      title: t("product"),
      links: [
        { href: "/feed", label: t("community") },
        { href: "/creators", label: tNav("creators") },
      ],
    },
    {
      title: t("help"),
      links: [
        { href: "/games/new", label: t("howToUpload") },
        { href: "/legal/guidelines", label: t("guidelines") },
      ],
    },
    {
      title: t("legal"),
      links: [
        { href: "/legal/terms", label: t("terms") },
        { href: "/legal/privacy", label: t("privacy") },
        { href: "/legal/copyright", label: t("copyright") },
      ],
    },
  ];

  return (
    <footer className="mx-auto mt-24 w-full max-w-[1200px] border-t border-white/8 px-6 pt-10 pb-8">
      <div className="flex flex-wrap gap-x-12 gap-y-10">
        <div className="min-w-[240px] flex-[1_1_280px]">
          <Link href="/" aria-label={tNav("home")} className="inline-flex min-h-11 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan">
            <Logo />
          </Link>
          <p className="mt-3.5 max-w-[300px] text-sm text-text-3">{t("tagline")}</p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-[0_1_170px] flex-col gap-1">
            <span className="mb-1 font-semibold">{column.title}</span>
            {column.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center text-sm text-text-3 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>

      <div className="mt-8 border-t border-white/6 pt-5">
        <p className="text-sm text-text-3">{t("rights", { year: process.env.NEXT_PUBLIC_BUILD_YEAR ?? "" })}</p>
      </div>
    </footer>
  );
}
