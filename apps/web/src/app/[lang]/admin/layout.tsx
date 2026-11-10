import { Suspense, type ReactNode } from "react";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { ExtraMessages } from "@/components/i18n/extra-messages";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";
import { countReports } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Frame of the administration: only admins get past it (anyone else sees a page that does not exist), with the sections as tabs. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("admin");
  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-[clamp(24px,5vw,48px)]">
      <header>
        <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight font-bold text-glow-violet">{t("title")}</h1>
        <p className="mt-1 max-w-[720px] text-text-2">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="min-h-svh rounded-3xl" aria-hidden="true" />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin("/admin");
  const counts = await countReports();
  return (
    <ExtraMessages namespaces={["admin"]}>
      <div className="grid gap-6">
        <AdminTabs openReports={counts.open} />
        {children}
      </div>
    </ExtraMessages>
  );
}
