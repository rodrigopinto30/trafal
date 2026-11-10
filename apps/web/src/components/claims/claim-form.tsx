"use client";

import { useActionState, useState } from "react";
import { CaptchaField, captchaEnabled } from "@/components/security/captcha-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { submitCopyrightClaimAction } from "@/lib/claims/actions";
import { initialFormState } from "@/lib/forms";
import { CLAIM_DESCRIPTION_MAX, CLAIM_EMAIL_MAX, CLAIM_NAME_MAX, CLAIM_ORG_MAX, CLAIM_SIGNATURE_MAX, CLAIM_URL_MAX } from "@/lib/validation/claims-rules";

/** The public form to claim copyright over something on the site. No account needed; the server checks everything again. */
export function ClaimForm({ example }: { example: string }) {
  const t = useTranslations("claims");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(submitCopyrightClaimAction, initialFormState);
  const [captchaReady, setCaptchaReady] = useState(!captchaEnabled);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const statementsError = errors.statementGoodFaith ?? errors.statementAccuracy;

  if (state.status === "success") {
    return (
      <div role="status" className="grid gap-2 rounded-3xl border border-cyan/40 bg-card p-6">
        <h2 className="font-display text-2xl font-bold">{t("sent.title")}</h2>
        <p className="text-text-2">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      {state.message ? <FormMessage>{state.message}</FormMessage> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="claim-name" label={t("name")} error={errors.claimantName}>
          {(control) => <Input {...control} name="claimantName" autoComplete="name" maxLength={CLAIM_NAME_MAX} required defaultValue={values.claimantName ?? ""} />}
        </Field>
        <Field id="claim-email" label={t("email")} hint={t("emailHint")} error={errors.claimantEmail}>
          {(control) => <Input {...control} type="email" name="claimantEmail" autoComplete="email" maxLength={CLAIM_EMAIL_MAX} required defaultValue={values.claimantEmail ?? ""} />}
        </Field>
      </div>

      <Field id="claim-org" label={t("org")} error={errors.claimantOrg}>
        {(control) => <Input {...control} name="claimantOrg" autoComplete="organization" maxLength={CLAIM_ORG_MAX} defaultValue={values.claimantOrg ?? ""} />}
      </Field>

      <Field id="claim-work" label={t("work")} hint={t("workHint")} error={errors.workDescription}>
        {(control) => <Textarea {...control} name="workDescription" rows={6} maxLength={CLAIM_DESCRIPTION_MAX} required defaultValue={values.workDescription ?? ""} />}
      </Field>

      <Field id="claim-original" label={t("original")} error={errors.originalUrl}>
        {(control) => <Input {...control} type="url" name="originalUrl" maxLength={CLAIM_URL_MAX} defaultValue={values.originalUrl ?? ""} />}
      </Field>

      <Field id="claim-urls" label={t("urls")} hint={t("urlsHint", { example })} error={errors.urls}>
        {(control) => <Textarea {...control} name="urls" rows={4} required defaultValue={values.urls ?? ""} />}
      </Field>

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-semibold">{t("statements")}</legend>
        <div className="flex items-start gap-3">
          <Checkbox id="claim-good-faith" name="statementGoodFaith" required defaultChecked={values.statementGoodFaith === "on"} aria-invalid={statementsError ? true : undefined} aria-describedby={statementsError ? "claim-statements-error" : undefined} className="mt-0.5" />
          <Label htmlFor="claim-good-faith" className="block font-normal text-text-2">
            {t("goodFaith")}
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="claim-accuracy" name="statementAccuracy" required defaultChecked={values.statementAccuracy === "on"} aria-invalid={statementsError ? true : undefined} aria-describedby={statementsError ? "claim-statements-error" : undefined} className="mt-0.5" />
          <Label htmlFor="claim-accuracy" className="block font-normal text-text-2">
            {t("accuracy")}
          </Label>
        </div>
        {statementsError ? (
          <p id="claim-statements-error" role="alert" className="text-sm font-medium text-[#ff8fa5]">
            {statementsError}
          </p>
        ) : null}
      </fieldset>

      <Field id="claim-signature" label={t("signature")} hint={t("signatureHint")} error={errors.signature}>
        {(control) => <Input {...control} name="signature" autoComplete="off" maxLength={CLAIM_SIGNATURE_MAX} required defaultValue={values.signature ?? ""} />}
      </Field>

      <CaptchaField resetKey={state} onReadyChange={setCaptchaReady} />

      <Button type="submit" size="lg" disabled={pending || !captchaReady}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
