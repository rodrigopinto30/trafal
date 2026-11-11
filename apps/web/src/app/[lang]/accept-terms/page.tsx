import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AcceptTermsForm } from "@/components/auth/accept-terms-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { getMyProfile, hasOutdatedTerms, requireUser } from "@/lib/auth/dal";
import { LEGAL_UPDATED } from "@/lib/legal/status";
import { firstParam, parseNextPath } from "@/lib/validation/common";

const DOCUMENTS = ["terms", "privacy", "guidelines", "copyright"] as const;

export async function generateMetadata() {
  const t = await getTranslations("terms");
  return { title: t("title"), robots: { index: false } };
}

export default async function AcceptTermsPage({ searchParams }: PageProps<"/[lang]/accept-terms">) {
  const t = await getTranslations("terms");
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")} namespaces={["terms"]}>
      <Suspense fallback={<Skeleton className="h-[260px] rounded-[28px]" />}>
        <AcceptTermsContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

/** Reads the session and the address (?next): inside <Suspense>. Whoever has nothing to accept goes on to where they were heading. */
async function AcceptTermsContent({ searchParams }: { searchParams: PageProps<"/[lang]/accept-terms">["searchParams"] }) {
  const params = await searchParams;
  const next = parseNextPath(firstParam(params.next)) ?? "/";
  const [t, locale] = await Promise.all([getTranslations("terms"), getLocale()]);

  await requireUser(`/accept-terms?next=${encodeURIComponent(next)}`);
  if (!(await getMyProfile())) redirect(localizePath(locale, `/onboarding?next=${encodeURIComponent(next)}`));
  if (!(await hasOutdatedTerms())) redirect(localizePath(locale, next));

  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(LEGAL_UPDATED));

  return (
    <div className="grid gap-6">
      <section aria-labelledby="terms-read" className="grid gap-3">
        <h2 id="terms-read" className="font-display text-lg font-bold">
          {t("readTitle")}
        </h2>
        <ul className="grid gap-2">
          {DOCUMENTS.map((document) => (
            <li key={document}>
              <Link href={`/legal/${document}`} target="_blank" rel="noopener noreferrer" className="text-cyan underline underline-offset-2 hover:text-white">
                {t(`documents.${document}`)}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm text-text-3">{t("updated", { date: updated })}</p>
      </section>
      <AcceptTermsForm next={next} />
    </div>
  );
}
