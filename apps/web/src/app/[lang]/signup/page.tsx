import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell, OrDivider } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { publicEnv } from "@/lib/env";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signup.title"), robots: { index: false, follow: true } };
}

export default async function SignupPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("signup.title")} subtitle={t("signup.subtitle")}>
      <Suspense fallback={<FormSkeleton />}>
        <SignupContent />
      </Suspense>
    </AuthShell>
  );
}

async function SignupContent() {
  const [t, tc, locale, user] = await Promise.all([
    getTranslations("auth"),
    getTranslations("common"),
    getLocale(),
    getAuthUser(),
  ]);
  if (user) redirect(localizePath(locale, "/"));

  return (
    <>
      <SignupForm />
      {publicEnv.googleEnabled ? (
        <>
          <OrDivider label={tc("or")} />
          <GoogleButton next="/onboarding" />
        </>
      ) : null}
      <p className="text-center text-sm text-text-2">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-cyan underline underline-offset-2 hover:text-white">
          {t("signup.loginLink")}
        </Link>
      </p>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden="true">
      <Skeleton className="h-[74px]" />
      <Skeleton className="h-[96px]" />
      <Skeleton className="h-[48px]" />
      <Skeleton className="h-[50px] rounded-full" />
    </div>
  );
}
