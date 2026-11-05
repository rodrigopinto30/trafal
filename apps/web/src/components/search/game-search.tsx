"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { GameCover } from "@/components/games/game-cover";
import { useLocale, useTranslations } from "@/i18n/client";
import { localizePath } from "@/i18n/path";
import { suggestGamesAction } from "@/lib/games/search-actions";
import type { GameSuggestion } from "@/lib/games/types";
import { SEARCH_QUERY_MAX, parseSearchQuery, parseSuggestionQuery } from "@/lib/validation/search";
import { cn } from "@/lib/utils";

const TYPING_PAUSE_MS = 200;
const SEE_ALL = "see-all";

type Props = {
  variant: "hero" | "page";
  defaultValue?: string;
};

type Option = { kind: "game"; game: GameSuggestion } | { kind: typeof SEE_ALL };

/** Posición activa tras apretar una flecha. Da la vuelta y pasa por «ninguna» (-1), que devuelve el foco al campo. */
function nextActive(current: number, step: 1 | -1, count: number): number {
  const slots = count + 1;
  return ((current + 1 + step + slots) % slots) - 1;
}

/**
 * Buscador de juegos con sugerencias en vivo (patrón combobox: flechas, Enter y Escape; un lector de pantalla oye cuántas
 * sugerencias hay). Sin JavaScript sigue funcionando: es un formulario GET a /explore.
 */
export function GameSearch({ variant, defaultValue = "" }: Props) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const ids = useId();
  const listboxId = `${ids}-listbox`;
  const container = useRef<HTMLDivElement>(null);
  const latestRequest = useRef(0);
  const [value, setValue] = useState(defaultValue);
  const [found, setFound] = useState<{ query: string; games: GameSuggestion[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const query = parseSearchQuery(value);
  const suggestionQuery = parseSuggestionQuery(value);
  const suggestions = found !== null && found.query === suggestionQuery ? found.games : [];
  const options: Option[] = suggestions.length > 0 ? [...suggestions.map((game) => ({ kind: "game" as const, game })), { kind: SEE_ALL }] : [];
  const expanded = open && options.length > 0;
  const announcement = found !== null && found.query === suggestionQuery ? t("count", { count: found.games.length }) : "";

  useEffect(() => {
    if (suggestionQuery === null) return;
    const request = ++latestRequest.current;
    const timer = setTimeout(async () => {
      const games = await suggestGamesAction(suggestionQuery).catch(() => []);
      if (request !== latestRequest.current) return;
      setFound({ query: suggestionQuery, games });
      setActive(-1);
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [suggestionQuery]);

  function goToResults(text: string | null) {
    setOpen(false);
    const path = text ? `/explore?q=${encodeURIComponent(text)}` : "/explore";
    router.push(localizePath(locale, path));
  }

  function goToOption(option: Option) {
    setOpen(false);
    if (option.kind === SEE_ALL) goToResults(query);
    else router.push(localizePath(locale, `/games/${option.game.public_id}`));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const option = active >= 0 ? options[active] : undefined;
    if (option) goToOption(option);
    else goToResults(query);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (expanded) event.preventDefault();
      setOpen(false);
      setActive(-1);
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => nextActive(current, step, options.length));
    }
  }

  const hero = variant === "hero";

  return (
    <div
      ref={container}
      className="relative mx-auto w-full max-w-[640px] text-left"
      onBlur={(event) => {
        if (!container.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form role="search" aria-label={t("label")} action={localizePath(locale, "/explore")} method="get" onSubmit={onSubmit}>
        <label htmlFor={`${ids}-input`} className="sr-only">
          {t("label")}
        </label>
        <div className="relative">
          <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 hidden size-5 -translate-y-1/2 text-text-3 sm:block" />
          <input
            id={`${ids}-input`}
            name="q"
            type="text"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? `${ids}-option-${active}` : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={SEARCH_QUERY_MAX}
            value={value}
            placeholder={t("placeholder")}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(
              "h-14 w-full min-w-0 rounded-full border border-white/20 bg-card pr-16 pl-5 text-base text-foreground sm:pr-[132px] sm:pl-13",
              "placeholder:text-text-3 outline-none transition-[border-color,box-shadow]",
              "focus-visible:border-cyan focus-visible:ring-2 focus-visible:ring-cyan/40",
              hero && "shadow-[0_0_32px_rgb(139_92_255/0.28)]",
            )}
          />
          <button
            type="submit"
            className="absolute top-1/2 right-1.5 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-sm font-bold text-ink sm:w-auto sm:px-6 outline-none transition-[box-shadow,filter] hover:brightness-110 hover:shadow-glow-violet focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <SearchIcon aria-hidden="true" className="size-5 sm:hidden" />
            <span className="max-sm:sr-only">{t("submit")}</span>
          </button>
        </div>
      </form>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {expanded ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t("suggestionsLabel")}
          className="absolute top-full right-0 left-0 z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-3xl border border-white/10 bg-popover p-2 shadow-[0_20px_60px_rgb(0_0_0/0.55),0_0_24px_rgb(46_230_255/0.15)]"
        >
          {options.map((option, index) => (
            <li
              key={option.kind === SEE_ALL ? SEE_ALL : option.game.public_id}
              id={`${ids}-option-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => goToOption(option)}
              onMouseMove={() => setActive(index)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2",
                index === active ? "bg-white/10" : "hover:bg-white/6",
                option.kind === SEE_ALL && "text-cyan",
              )}
            >
              {option.kind === "game" ? (
                <>
                  <GameCover game={option.game} className="aspect-square size-10 shrink-0 rounded-xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">{option.game.title}</span>
                    <span className="block truncate text-sm text-text-3">{t("by", { creator: option.game.creator })}</span>
                  </span>
                </>
              ) : (
                <span className="truncate font-semibold">{t("viewAll", { query: query ?? "" })}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
