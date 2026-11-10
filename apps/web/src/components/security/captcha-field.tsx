"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "@/i18n/client";
import { publicEnv } from "@/lib/env";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoading: Promise<TurnstileApi> | null = null;

/** Loads the script of Cloudflare once (only on the pages that have a captcha) and gives back its API. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => reject(new Error("turnstile could not be loaded"));
    document.head.append(script);
  }).catch((error: unknown) => {
    scriptLoading = null;
    throw error;
  });
  return scriptLoading;
}

/** Whether this site shows a captcha (it has the public key of Turnstile). */
export const captchaEnabled = publicEnv.turnstileSiteKey !== "";

type Props = {
  /** Anything that changes after each attempt (the result of the form action): a token is good for one use, so the captcha starts again. */
  resetKey: unknown;
  /** Tells the form whether it has a solved captcha, so it can keep its button off until then. */
  onReadyChange: (ready: boolean) => void;
};

/**
 * The captcha of a form: the widget of Cloudflare Turnstile and the hidden field `captchaToken` with its answer. It renders nothing
 * if the site has no key (local development). The server checks the answer again: this only collects it.
 */
export function CaptchaField({ resetKey, onReadyChange }: Props) {
  const t = useTranslations("common");
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const first = useRef(true);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!captchaEnabled) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        widget.current = turnstile.render(container.current, {
          sitekey: publicEnv.turnstileSiteKey,
          theme: "dark",
          language: locale,
          callback: (answer: string) => {
            setToken(answer);
            setFailed(false);
            onReadyChange(true);
          },
          "expired-callback": () => {
            setToken("");
            onReadyChange(false);
          },
          "error-callback": () => {
            setToken("");
            setFailed(true);
            onReadyChange(false);
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onReadyChange(false);
      });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [locale, onReadyChange]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!captchaEnabled || !widget.current) return;
    setToken("");
    onReadyChange(false);
    window.turnstile?.reset(widget.current);
  }, [resetKey, onReadyChange]);

  if (!captchaEnabled) return null;

  return (
    <div className="grid gap-2">
      <input type="hidden" name="captchaToken" value={token} />
      <div ref={container} aria-label={t("captcha.label")} className="min-h-[65px]" />
      {failed ? (
        <p role="alert" className="text-sm font-medium text-[#ff8fa5]">
          {t("captcha.error")}
        </p>
      ) : token === "" ? (
        <p role="status" className="text-sm text-text-3">
          {t("captcha.loading")}
        </p>
      ) : null}
    </div>
  );
}
