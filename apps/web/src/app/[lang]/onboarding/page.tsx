import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/profile/onboarding-form";
import { Skeleton } from "@/components/ui/skeleton";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { consentedAtSignup, getMyProfile, requireUser } from "@/lib/auth/dal";
import { firstParam, parseNextPath } from "@/lib/validation/common";

export async function generateMetadata() {
  const t = await getTranslations("onboarding");
  return { title: t("title"), robots: { index: false } };
}

export default async function OnboardingPage({ searchParams }: PageProps<"/[lang]/onboarding">) {
  const t = await getTranslations("onboarding");
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <Suspense fallback={<FormSkeleton />}>
        <OnboardingContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function OnboardingContent({ searchParams }: { searchParams: PageProps<"/[lang]/onboarding">["searchParams"] }) {
  const next = parseNextPath(firstParam((await searchParams).next));

  const user = await requireUser("/onboarding");
  const [profile, locale] = await Promise.all([getMyProfile(), getLocale()]);
  // Si ya tiene perfil no hay nada que completar.
  if (profile) redirect(localizePath(locale, next ?? `/u/${profile.username}`));

  const meta = user.user_metadata as Record<string, unknown>;
  const suggestedName = [meta.full_name, meta.name].find((value): value is string => typeof value === "string" && value.trim() !== "");
  const defaultDisplayName = suggestedName ?? user.email?.split("@")[0] ?? "";

  return <OnboardingForm next={next} defaultDisplayName={defaultDisplayName} askConsent={!consentedAtSignup(user)} />;
}

function FormSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden="true">
      <Skeleton className="h-[110px]" />
      <Skeleton className="h-[96px]" />
      <Skeleton className="h-[50px] rounded-full" />
    </div>
  );
}
