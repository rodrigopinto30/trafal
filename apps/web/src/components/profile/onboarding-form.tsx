"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { MIN_AGE } from "@/lib/auth/terms";
import { initialFormState } from "@/lib/forms";
import { onboardingAction } from "@/lib/profile/actions";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { USERNAME_MAX, checkUsernameFormat, normalizeUsername, suggestUsernames, usernameProblem } from "@/lib/username";
import { cn } from "@/lib/utils";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "reserved";

type Props = {
  next: string | null;
  defaultDisplayName: string;
  /** false si ya marcó la casilla de 18+ y términos al registrarse con email. */
  askConsent: boolean;
};

export function OnboardingForm({ next, defaultDisplayName, askConsent }: Props) {
  const t = useTranslations("onboarding");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(onboardingAction, initialFormState);
  const [username, setUsername] = useState(state.values?.username ?? "");
  const [checked, setChecked] = useState<{ value: string; available: boolean; suggestions: string[] } | null>(null);
  const usernameInput = useRef<HTMLInputElement>(null);

  const normalized = normalizeUsername(username);
  const format = normalized ? checkUsernameFormat(normalized) : null;

  // Disponibilidad en vivo: se consulta (con demora) solo cuando la forma ya es válida. Si el nombre está ocupado se buscan
  // alternativas libres (sin números). Si la consulta falla no se afirma nada: el servidor vuelve a validar al enviar.
  useEffect(() => {
    if (!normalized || checkUsernameFormat(normalized) !== "ok") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const supabase = await loadBrowserClient();
      const { data, error } = await supabase.rpc("username_available", { p_username: normalized });
      if (cancelled || error) return;
      if (data === true) {
        setChecked({ value: normalized, available: true, suggestions: [] });
        return;
      }
      const candidates = suggestUsernames(normalized).slice(0, 6);
      const answers = await Promise.all(
        candidates.map(async (candidate) => {
          const answer = await supabase.rpc("username_available", { p_username: candidate });
          return answer.data === true ? candidate : null;
        }),
      );
      if (!cancelled) {
        setChecked({ value: normalized, available: false, suggestions: answers.filter((value): value is string => value !== null).slice(0, 3) });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized]);

  let status: UsernameStatus = "idle";
  if (format === "invalid" || format === "reserved") status = format;
  else if (format === "ok") status = checked?.value === normalized ? (checked.available ? "available" : "taken") : "checking";

  // «Muy corto» no es un error mientras la persona todavía está escribiendo: va en la línea de estado, sin rojo ni alerta
  // (un lector de pantalla lo anunciaría en cada tecla). Si envía así, el servidor devuelve el error de verdad.
  const problem = status === "invalid" ? usernameProblem(normalized) : null;
  const stillTyping = problem === "tooShort";
  let localError: string | undefined;
  if (status === "invalid" && !stillTyping) localError = t(`usernameStatus.invalid.${problem ?? "characters"}`);
  else if (status === "reserved" || status === "taken") localError = t(`usernameStatus.${status}`);
  // El error del servidor solo vale para el nombre que se envió: si la persona lo cambió, manda lo que se ve en vivo.
  const serverUsernameError =
    state.values?.username !== undefined && normalizeUsername(state.values.username) === normalized ? state.fieldErrors?.username : undefined;
  const usernameError = serverUsernameError ?? localError;
  const suggestions = status === "taken" && checked?.value === normalized ? checked.suggestions : [];
  const consentError = state.fieldErrors?.consent;

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.message ? <FormMessage>{state.message}</FormMessage> : null}

      <Field id="username" label={t("username")} hint={t("usernameHint")} error={usernameError}>
        {(control) => (
          <div className="grid gap-2">
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-3">
                @
              </span>
              <Input
                {...control}
                ref={usernameInput}
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={USERNAME_MAX}
                required
                className="pl-9"
              />
            </div>
            <p
              aria-live="polite"
              className={cn("min-h-5 text-sm", status === "available" ? "text-cyan" : "text-text-3")}
            >
              {status === "checking" ? t("usernameStatus.checking") : null}
              {stillTyping ? t("usernameStatus.invalid.tooShort") : null}
              {/* Si lo que escribió no es exactamente lo que se guarda (mayúsculas, acentos, espacios), se le dice cuál será. */}
              {status === "available" ? (normalized === username ? t("usernameStatus.available") : t("usernameStatus.availableAs", { username: normalized })) : null}
            </p>
            {suggestions.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-sm text-text-3">{t("usernameSuggest")}</p>
                <ul className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        aria-label={t("usernameSuggestUse", { username: suggestion })}
                        onClick={() => {
                          setUsername(suggestion);
                          usernameInput.current?.focus();
                        }}
                        className="inline-flex h-11 items-center rounded-full border border-cyan/40 bg-cyan/8 px-4 text-sm font-semibold text-cyan transition-colors outline-none hover:bg-cyan/15 focus-visible:ring-2 focus-visible:ring-cyan"
                      >
                        @{suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Field>

      <Field id="displayName" label={t("displayName")} hint={t("displayNameHint")} error={state.fieldErrors?.displayName}>
        {(control) => (
          <Input
            {...control}
            name="displayName"
            autoComplete="name"
            maxLength={50}
            required
            defaultValue={state.values?.displayName ?? defaultDisplayName}
          />
        )}
      </Field>

      {askConsent ? (
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
              {tAuth.rich("signup.consent", { age: MIN_AGE }, {
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
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
