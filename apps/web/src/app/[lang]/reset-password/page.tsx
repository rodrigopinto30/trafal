import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("reset.title") };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("reset.title")} subtitle={t("reset.subtitle")}>
      <Suspense fallback={<Skeleton className="h-[220px]" />}>
        <ResetContent />
      </Suspense>
    </AuthShell>
  );
}

/** El link del mail deja una sesión de recuperación; sin ella, no hay nada que cambiar. */
async function ResetContent() {
  const [locale, user] = await Promise.all([getLocale(), getAuthUser()]);
  if (!user) redirect(localizePath(locale, "/login?error=linkExpired"));
  return <ResetPasswordForm />;
}
