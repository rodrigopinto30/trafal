"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RevealedMessage } from "@/components/ui/revealed-message";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { updateGameAction } from "@/lib/games/edit-actions";
import { CONTROLS_MAX, DESCRIPTION_MAX, MAX_QUESTIONS, TITLE_MAX } from "@/lib/games/upload-rules";
import { GENRE_IDS } from "@/lib/profile/catalog";

const IMAGE_TYPES = "image/png,image/jpeg,image/webp";
const GIF_TYPES = "image/gif";

export type EditGameFormProps = {
  game: {
    id: string;
    publicId: string;
    title: string;
    shortDescription: string;
    genreId: string | null;
    tags: string[];
    controls: string;
    questions: string[];
    coverUrl: string | null;
    gifUrl: string | null;
  };
};

/**
 * Form to change a game that was already uploaded: details, feedback questions, cover and GIF (each one kept, replaced or
 * removed). It sends everything to `updateGameAction`, which validates again and saves it all or nothing. The page gives it a
 * `key` that changes with every save, so it always starts from what is stored.
 */
export function EditGameForm({ game }: EditGameFormProps) {
  const t = useTranslations("gameForm");
  const tEdit = useTranslations("gameEdit");
  const tGenres = useTranslations("genres");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | undefined>();

  const [errorRound, setErrorRound] = useState(0);
  useEffect(() => {
    if (errorRound > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errorRound]);

  function showErrors(errors: Record<string, string>, general?: string) {
    setFieldErrors(errors);
    setFormMessage(general);
    setErrorRound((round) => round + 1);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    data.set("gameId", game.id);
    data.set("lang", locale);

    setFormMessage(undefined);
    setFieldErrors({});
    setSaving(true);
    const result = await updateGameAction(data);
    if (!result.ok) {
      setSaving(false);
      showErrors(result.fieldErrors, result.message);
      return;
    }
    toast.success(tEdit("saved"));
    window.scrollTo(0, 0);
    router.push(localizePath(locale, `/games/${result.publicId}/manage`));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6">
      <fieldset disabled={saving} className="grid min-w-0 gap-6">
        <SettingsSection title={t("detailsTitle")}>
          <div className="grid gap-6">
            <Field id="title" label={t("fields.title")} error={fieldErrors.title}>
              {(control) => <Input {...control} name="title" maxLength={TITLE_MAX} required autoComplete="off" defaultValue={game.title} />}
            </Field>
            <Field id="shortDescription" label={t("fields.shortDescription")} hint={t("fields.shortDescriptionHint")} error={fieldErrors.shortDescription}>
              {(control) => <Input {...control} name="shortDescription" maxLength={DESCRIPTION_MAX} autoComplete="off" defaultValue={game.shortDescription} />}
            </Field>
            <Field id="genre" label={t("fields.genre")} error={fieldErrors.genre}>
              {(control) => (
                <NativeSelect {...control} name="genre" required defaultValue={game.genreId ?? ""}>
                  <option value="">{t("fields.genrePlaceholder")}</option>
                  {GENRE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {tGenres(id as Parameters<typeof tGenres>[0])}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field id="tags" label={t("fields.tags")} hint={t("fields.tagsHint")} error={fieldErrors.tags}>
              {(control) => <Input {...control} name="tags" autoComplete="off" defaultValue={game.tags.join(", ")} />}
            </Field>
            <Field id="controls" label={t("fields.controls")} hint={t("fields.controlsHint")} error={fieldErrors.controls}>
              {(control) => <Textarea {...control} name="controls" maxLength={CONTROLS_MAX} rows={4} defaultValue={game.controls} />}
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title={t("filesTitle")}>
          <div className="grid gap-6">
            <div className="grid gap-3">
              <p className="text-sm font-semibold">{tEdit("currentCover")}</p>
              {game.coverUrl ? (
                <>
                  <img src={game.coverUrl} alt="" className="aspect-video w-full max-w-sm rounded-2xl border border-white/10 object-cover" />
                  <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm">
                    <Checkbox name="removeCover" value="1" />
                    {tEdit("removeCover")}
                  </label>
                </>
              ) : (
                <p className="text-sm text-text-2">{tEdit("noCover")}</p>
              )}
            </div>
            <Field id="cover" label={tEdit("coverReplace")} hint={tEdit("coverReplaceHint")} error={fieldErrors.cover}>
              {(control) => <Input {...control} name="cover" type="file" accept={IMAGE_TYPES} className="py-2.5" />}
            </Field>

            <div className="grid gap-3">
              <p className="text-sm font-semibold">{tEdit("currentGif")}</p>
              {game.gifUrl ? (
                <>
                  <img src={game.gifUrl} alt="" className="aspect-video w-full max-w-sm rounded-2xl border border-white/10 object-cover" />
                  <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm">
                    <Checkbox name="removeGif" value="1" />
                    {tEdit("removeGif")}
                  </label>
                </>
              ) : (
                <p className="text-sm text-text-2">{tEdit("noGif")}</p>
              )}
            </div>
            <Field id="gif" label={tEdit("gifReplace")} hint={tEdit("gifReplaceHint")} error={fieldErrors.gif}>
              {(control) => <Input {...control} name="gif" type="file" accept={GIF_TYPES} className="py-2.5" />}
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title={t("feedbackTitle")} description={t("feedbackHint")}>
          <div className="grid gap-5">
            {Array.from({ length: MAX_QUESTIONS }, (_, index) => (
              <Field
                key={index}
                id={`question-${index + 1}`}
                label={t("fields.question", { number: index + 1 })}
                error={index === 0 ? (fieldErrors.questions ?? undefined) : undefined}
              >
                {(control) => (
                  <Input
                    {...control}
                    name="questions"
                    maxLength={140}
                    placeholder={t("fields.questionPlaceholder")}
                    autoComplete="off"
                    defaultValue={game.questions[index] ?? ""}
                  />
                )}
              </Field>
            ))}
          </div>
        </SettingsSection>
      </fieldset>

      <div className="grid gap-3">
        {formMessage ? <RevealedMessage>{formMessage}</RevealedMessage> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? (
              <>
                <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {tEdit("submitting")}
              </>
            ) : (
              tEdit("submit")
            )}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/games/${game.publicId}/manage`}>{tEdit("cancel")}</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
