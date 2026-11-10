"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useTranslations } from "@/i18n/client";
import { clearFeaturedGameAction, setFeaturedGameAction } from "@/lib/admin/actions";
import { ADMIN_ERROR_KEYS, FEATURED_QUOTE_MAX, type AdminErrorKey } from "@/lib/validation/admin-rules";

type Props = { games: { id: string; title: string; owner: string }[]; weeks: { value: string; label: string }[] };

function isErrorKey(value: string): value is AdminErrorKey {
  return (ADMIN_ERROR_KEYS as readonly string[]).includes(value);
}

/** Form to choose the first game of a week, with an optional quote. The database checks everything: who can choose, which game and which week. */
export function FeaturedForm({ games, weeks }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [gameId, setGameId] = useState("");
  const [week, setWeek] = useState(weeks[0]?.value ?? "");
  const [quote, setQuote] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await setFeaturedGameAction({ gameId, week, quote });
      if (result.ok) {
        toast.success(t("featured.chosen"));
        setGameId("");
        setQuote("");
        router.refresh();
        return;
      }
      setMessage(t(`errors.${isErrorKey(result.error) ? result.error : "generic"}`));
    });
  }

  if (games.length === 0) return <p className="text-text-2">{t("featured.noEligible")}</p>;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending && gameId !== "") submit();
      }}
    >
      {message ? <FormMessage>{message}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="featured-game" label={t("featured.game")}>
          {(control) => (
            <NativeSelect {...control} value={gameId} disabled={pending} onChange={(event) => setGameId(event.target.value)}>
              <option value="">{t("featured.gamePlaceholder")}</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {t("featured.gameOption", { title: game.title, owner: game.owner })}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="featured-week" label={t("featured.week")}>
          {(control) => (
            <NativeSelect {...control} value={week} disabled={pending} onChange={(event) => setWeek(event.target.value)}>
              {weeks.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>
      <Field id="featured-quote" label={t("featured.quote")} hint={t("featured.quoteHint")}>
        {(control) => <Input {...control} value={quote} maxLength={FEATURED_QUOTE_MAX} disabled={pending} autoComplete="off" onChange={(event) => setQuote(event.target.value)} />}
      </Field>
      <div>
        <Button type="submit" size="lg" disabled={pending || gameId === ""}>
          {t("featured.submit")}
        </Button>
      </div>
    </form>
  );
}

/** Takes off the pick of a week. */
export function ClearFeaturedButton({ week }: { week: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await clearFeaturedGameAction({ week });
          if (result.ok) {
            toast.success(t("featured.cleared"));
            router.refresh();
          } else {
            toast.error(t(`errors.${isErrorKey(result.error) ? result.error : "generic"}`));
          }
        })
      }
    >
      {t("featured.clear")}
    </Button>
  );
}
