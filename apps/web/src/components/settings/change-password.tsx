"use client";

import { useActionState, useState } from "react";
import { CaptchaField, captchaEnabled } from "@/components/security/captcha-field";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { PasswordInput } from "@/components/ui/password-input";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { changePasswordAction } from "@/lib/account/actions";
import { initialFormState } from "@/lib/forms";
import { useSuccessToast } from "@/lib/use-success-toast";
import { DELETE_SECRET_MAX } from "@/lib/validation/account-rules";

/**
 * Changing the password: the current one and the new one twice. The passwords live in state (React 19 empties uncontrolled fields
 * when an action ends, and they never come back from the server) and are cleared once the change is saved.
 */
export function ChangePassword() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(changePasswordAction, initialFormState);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [captchaReady, setCaptchaReady] = useState(!captchaEnabled);
  const [handled, setHandled] = useState(state);
  useSuccessToast(state);

  if (handled !== state) {
    setHandled(state);
    if (state.status === "success") {
      setCurrent("");
      setPassword("");
      setConfirm("");
    }
  }

  const toggle = { showLabel: t("password.show"), hideLabel: t("password.hide") };

  return (
    <form action={formAction} noValidate className="grid max-w-[420px] gap-5">
      <input type="hidden" name="lang" value={locale} />
      {state.status === "error" && state.message ? <FormMessage>{state.message}</FormMessage> : null}
      <Field id="change-password-current" label={t("password.current")} error={state.fieldErrors?.current}>
        {(control) => (
          <PasswordInput {...control} name="current" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" maxLength={DELETE_SECRET_MAX} {...toggle} />
        )}
      </Field>
      <Field id="change-password-new" label={t("password.new")} hint={t("password.newHint")} error={state.fieldErrors?.password}>
        {(control) => <PasswordInput {...control} name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} {...toggle} />}
      </Field>
      <Field id="change-password-confirm" label={t("password.confirm")} error={state.fieldErrors?.confirm}>
        {(control) => <PasswordInput {...control} name="confirm" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} {...toggle} />}
      </Field>
      <CaptchaField action="change_password" resetKey={state} onReadyChange={setCaptchaReady} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Button type="submit" disabled={pending || !captchaReady}>
          {pending ? t("password.submitting") : t("password.submit")}
        </Button>
        <Link href="/forgot-password" className="inline-flex min-h-11 items-center rounded-lg text-sm text-text-2 underline-offset-4 hover:text-foreground hover:underline">
          {t("password.forgot")}
        </Link>
      </div>
    </form>
  );
}
