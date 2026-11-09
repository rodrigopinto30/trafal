import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("forgot.title"), robots: { index: false, follow: true } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("forgot.title")} subtitle={t("forgot.subtitle")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
