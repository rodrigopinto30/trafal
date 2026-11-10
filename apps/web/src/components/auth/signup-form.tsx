"use client";

import { useActionState, useState } from "react";
import { CaptchaField, captchaEnabled } from "@/components/security/captcha-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { signupAction } from "@/lib/auth/actions";
import { MIN_AGE } from "@/lib/auth/terms";
import { initialFormState } from "@/lib/forms";

export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(signupAction, initialFormState);
  // Las dos contraseñas son controladas: React 19 vacía los campos no controlados al terminar la acción, y nunca vuelven del servidor.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [captchaReady, setCaptchaReady] = useState(!captchaEnabled);

  if (state.status === "success") {
    return (
      <div className="grid gap-5" role="status">
        <h2 className="font-display text-2xl font-bold">{t("checkEmail.title")}</h2>
        <p className="text-text-2">{t.rich("checkEmail.text", { email: state.sentTo ?? "" }, { strong: (c) => <strong className="break-all text-foreground">{c}</strong> })}</p>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">{t("checkEmail.back")}</Link>
        </Button>
      </div>
    );
  }

  const consentError = state.fieldErrors?.consent;

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      {state.message ? <FormMessage>{state.message}</FormMessage> : null}

      <Field id="email" label={t("email")} error={state.fieldErrors?.email}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} />
        )}
      </Field>

      <Field id="password" label={t("password")} hint={t("passwordHint")} error={state.fieldErrors?.password}>
        {(control) => (
          <PasswordInput
            {...control}
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>

      <Field id="confirm" label={t("confirmPassword")} error={state.fieldErrors?.confirm}>
        {(control) => (
          <PasswordInput
            {...control}
            name="confirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>

      <div className="grid gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="consent"
            name="consent"
            required
            // No controlada, con el valor que devuelve el servidor: React 19 resetea el formulario al terminar la acción y
            // vuelve al «defaultChecked» ya actualizado, así que la casilla sigue tildada si el error fue otro.
            defaultChecked={state.values?.consent === "on"}
            aria-invalid={consentError ? true : undefined}
            aria-describedby={consentError ? "consent-error" : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="consent" className="block font-normal text-text-2">
            {t.rich("signup.consent", { age: MIN_AGE }, {
              terms: (c) => (
                <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-cyan underline underline-offset-2 hover:text-white">
                  {c}
                </Link>
              ),
              privacy: (c) => (
                <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan underline underline-offset-2 hover:text-white">
                  {c}
                </Link>
              ),
            })}
          </Label>
        </div>
        {consentError ? (
          <p id="consent-error" role="alert" className="text-sm font-medium text-[#ff8fa5]">
            {consentError}
          </p>
        ) : null}
      </div>

      <CaptchaField resetKey={state} onReadyChange={setCaptchaReady} />

      <Button type="submit" size="lg" disabled={pending || !captchaReady}>
        {pending ? t("signup.submitting") : t("signup.submit")}
      </Button>
    </form>
  );
}
