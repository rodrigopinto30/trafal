import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell, OrDivider } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { getLocale, getTranslations } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { publicEnv } from "@/lib/env";
import { firstParam, parseLoginError, parseNextPath } from "@/lib/validation/common";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("login.title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("login.title")} subtitle={t("login.subtitle")}>
      <Suspense fallback={<FormSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

/** Lee la URL (?next, ?error) y la sesión: por eso vive dentro de <Suspense>. */
async function LoginContent({ searchParams }: { searchParams: PageProps<"/[lang]/login">["searchParams"] }) {
  const params = await searchParams;
  const next = parseNextPath(firstParam(params.next)) ?? "/";
  const error = parseLoginError(firstParam(params.error));

  const [t, tc, locale, user] = await Promise.all([getTranslations("auth"), getTranslations("common"), getLocale(), getAuthUser()]);
  if (user) redirect(localizePath(locale, next));

  const initialError =
    error === "linkExpired" ? t("errors.linkExpired") : error === "oauthFailed" ? t("errors.oauthFailed") : undefined;
  const signupHref = next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  return (
    <>
      <LoginForm next={next} initialError={initialError} />
      {publicEnv.googleEnabled ? (
        <>
          <OrDivider label={tc("or")} />
          <GoogleButton next={next} />
        </>
      ) : null}
      <p className="text-center text-sm text-text-2">
        {t("login.noAccount")}{" "}
        <Link href={signupHref} className="inline-flex min-h-11 items-center font-semibold text-cyan underline underline-offset-2 hover:text-white">
          {t("login.signupLink")}
        </Link>
      </p>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden="true">
      <Skeleton className="h-[74px]" />
      <Skeleton className="h-[74px]" />
      <Skeleton className="h-[50px] rounded-full" />
    </div>
  );
}
