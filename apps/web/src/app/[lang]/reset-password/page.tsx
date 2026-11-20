import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { PASSWORD_RESET_SECONDS, getAuthUser, signedInRecently } from "@/lib/auth/dal";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("reset.title"), robots: { index: false, follow: true } };
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

/**
 * Solo con la sesión que deja el link del mail, y por unos minutos: una sesión abierta cualquiera (una compu ajena, una pestaña
 * olvidada) no alcanza para cambiar la contraseña y quedarse con la cuenta. Muestra de qué cuenta es, así un link ajeno que
 * alguien hizo abrir no pasa desapercibido.
 */
async function ResetContent() {
  const [locale, fromEmailLink, user, t] = await Promise.all([getLocale(), signedInRecently(PASSWORD_RESET_SECONDS, "otp"), getAuthUser(), getTranslations("auth")]);
  if (!fromEmailLink || !user) redirect(localizePath(locale, "/login?error=linkExpired"));
  return (
    <div className="grid gap-5">
      <p className="text-sm text-text-2">{t("reset.forAccount", { email: user.email ?? "" })}</p>
      <ResetPasswordForm />
    </div>
  );
}
