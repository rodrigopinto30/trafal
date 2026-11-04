"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { loginAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(loginAction, initialFormState);
  // Controlada: React 19 vacía los campos no controlados al terminar la acción, y la contraseña nunca vuelve del servidor.
  const [password, setPassword] = useState("");
  const message = state.message ?? (state.status === "idle" ? initialError : undefined);

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="next" value={next} />
      {message ? <FormMessage>{message}</FormMessage> : null}

      <Field id="email" label={t("email")} error={state.fieldErrors?.email}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} />
        )}
      </Field>

      <Field
        id="password"
        label={t("password")}
        error={state.fieldErrors?.password}
        aside={
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm text-cyan hover:underline">
            {t("login.forgot")}
          </Link>
        }
      >
        {(control) => (
          <PasswordInput
            {...control}
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
