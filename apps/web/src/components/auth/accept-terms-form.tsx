"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { acceptTermsAction } from "@/lib/auth/actions";
import { MIN_AGE } from "@/lib/auth/terms";
import { initialFormState } from "@/lib/forms";

const LINK_CLASS = "text-cyan underline underline-offset-2 hover:text-white";

/** The box that confirms the age and accepts the current terms, for people who accepted an older version. */
export function AcceptTermsForm({ next }: { next: string }) {
  const t = useTranslations("terms");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(acceptTermsAction, initialFormState);
  const consentError = state.fieldErrors?.consent;

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="next" value={next} />
      {state.message ? <FormMessage>{state.message}</FormMessage> : null}

      <div className="grid gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="consent"
            name="consent"
            required
            defaultChecked={state.values?.consent === "on"}
            aria-invalid={consentError ? true : undefined}
            aria-describedby={consentError ? "consent-error" : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="consent" className="block font-normal text-text-2">
            {t.rich("consent", { age: MIN_AGE }, {
              terms: (chunks) => (
                <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                  {chunks}
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

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>

      <p className="text-sm text-text-2">
        {t.rich("decline", {}, {
          delete: (chunks) => (
            <Link href="/settings/account" className={LINK_CLASS}>
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
