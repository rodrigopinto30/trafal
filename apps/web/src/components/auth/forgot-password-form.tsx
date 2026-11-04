"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialFormState);

  if (state.status === "success") {
    return (
      <div className="grid gap-5" role="status">
        <h2 className="font-display text-2xl font-bold">{t("forgot.sentTitle")}</h2>
        <p className="text-text-2">{t("forgot.sentText")}</p>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">{t("forgot.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      {state.message ? <FormMessage>{state.message}</FormMessage> : null}
      <Field id="email" label={t("email")} error={state.fieldErrors?.email}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} />
        )}
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("forgot.submitting") : t("forgot.submit")}
      </Button>
    </form>
  );
}
