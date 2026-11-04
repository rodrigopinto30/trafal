"use client";

import { CheckIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { useLocale, useTranslations } from "@/i18n/client";
import { locales, type Locale } from "@/i18n/config";
import { initialFormState } from "@/lib/forms";
import { updatePreferencesAction } from "@/lib/settings/actions";

/**
 * Selector de idioma de la cuenta. El idioma de entrada sale del navegador/sistema; acá la persona puede fijar otro y
 * queda guardado en su cuenta (también para otros dispositivos).
 */
export function LanguageForm() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const current = useLocale();
  const [state, formAction, pending] = useActionState(updatePreferencesAction, initialFormState);
  const [chosen, setChosen] = useState<Locale>(current);

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={current} />
      {state.status === "error" && state.message ? <FormMessage>{state.message}</FormMessage> : null}

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold text-text-2">{t("preferences.languageLabel")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {locales.map((locale) => (
            <label key={locale} lang={locale} className="relative flex">
              <input
                type="radio"
                name="locale"
                value={locale}
                checked={chosen === locale}
                onChange={() => setChosen(locale)}
                className="peer sr-only"
              />
              <span className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 text-base font-semibold text-text-2 transition-[background-color,border-color,box-shadow] hover:border-white/30 peer-checked:border-violet peer-checked:bg-violet/22 peer-checked:text-white peer-checked:shadow-glow-violet peer-focus-visible:ring-2 peer-focus-visible:ring-cyan peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100">
                {tc(`languageName.${locale}`)}
                <CheckIcon aria-hidden="true" className="size-5 text-cyan" strokeWidth={3} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? tc("saving") : t("preferences.save")}
        </Button>
      </div>
    </form>
  );
}
