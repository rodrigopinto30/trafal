"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { PasswordInput } from "@/components/ui/password-input";
import { useLocale, useTranslations } from "@/i18n/client";
import { resetPasswordAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialFormState);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      {state.message ? <FormMessage>{state.message}</FormMessage> : null}

      <Field id="password" label={t("reset.newPassword")} hint={t("passwordHint")} error={state.fieldErrors?.password}>
        {(control) => (
          <PasswordInput {...control} name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} showLabel={t("showPassword")} hideLabel={t("hidePassword")} />
        )}
      </Field>
      <Field id="confirm" label={t("confirmPassword")} error={state.fieldErrors?.confirm}>
        {(control) => (
          <PasswordInput {...control} name="confirm" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required minLength={8} showLabel={t("showPassword")} hideLabel={t("hidePassword")} />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("reset.submitting") : t("reset.submit")}
      </Button>
    </form>
  );
}
