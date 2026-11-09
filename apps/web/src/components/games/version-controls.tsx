"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { activateVersionAction, updateVersionAction } from "@/lib/games/version-actions";
import { VERSION_CHANGELOG_MAX, VERSION_LABEL_MAX } from "@/lib/validation/game-rules";

type Props = {
  versionId: string;
  label: string;
  changelog: string;
  /** True when the version is ready and is not the one being played, so it can be chosen. */
  canActivate: boolean;
};

/** Per-version actions of the owner's game page: «use this version» and a dialog to rename it and edit its changelog. */
export function VersionControls({ versionId, label, changelog, canActivate }: Props) {
  const t = useTranslations("gameVersions");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftChangelog, setDraftChangelog] = useState(changelog);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function activate() {
    setMessage(null);
    startTransition(async () => {
      const result = await activateVersionAction(versionId, locale);
      if (result.ok) router.refresh();
      else setMessage(result.message);
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateVersionAction({ versionId, label: draftLabel, changelog: draftChangelog }, locale);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else setMessage(result.message);
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDraftLabel(label);
      setDraftChangelog(changelog);
    }
    setMessage(null);
  }

  return (
    <div className="grid gap-2">
      {message && !open ? <FormMessage>{message}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        {canActivate ? (
          <Button type="button" variant="outline" disabled={pending} onClick={activate}>
            {pending ? t("activating") : t("activate")}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => onOpenChange(true)} aria-label={t("editAria", { label })}>
          {t("edit")}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{t("editHelp")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field id={`edit-label-${versionId}`} label={t("editLabel")}>
              {(control) => <Input {...control} value={draftLabel} maxLength={VERSION_LABEL_MAX} onChange={(event) => setDraftLabel(event.target.value)} />}
            </Field>
            <Field id={`edit-changelog-${versionId}`} label={t("changelog")} hint={t("changelogHint")}>
              {(control) => (
                <Textarea {...control} value={draftChangelog} maxLength={VERSION_CHANGELOG_MAX} rows={5} onChange={(event) => setDraftChangelog(event.target.value)} />
              )}
            </Field>
            <Button type="button" size="lg" disabled={pending || draftLabel.trim() === ""} onClick={save}>
              {pending ? t("saving") : t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
