"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { submitAppealAction } from "@/lib/appeals/actions";
import { APPEAL_MESSAGE_MAX, type AppealTarget } from "@/lib/validation/appeal-rules";

/** «Appeal» button of a decision about the signed-in person, and its dialog: they say why they think it was a mistake. */
export function AppealButton({ targetType, targetId }: { targetType: AppealTarget; targetId: string }) {
  const t = useTranslations("appeals");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setText("");
      setMessage(null);
    }
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitAppealAction({ targetType, targetId, message: text }, locale);
      if (result.ok) {
        toast.success(t("dialog.sent"));
        setOpen(false);
        setText("");
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t("appeal")}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.text")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field id={`appeal-${targetId}`} label={t("dialog.label")} hint={t("dialog.hint", { max: APPEAL_MESSAGE_MAX })}>
              {(control) => <Textarea {...control} value={text} maxLength={APPEAL_MESSAGE_MAX} rows={5} onChange={(event) => setText(event.target.value)} />}
            </Field>
            <Button type="button" size="lg" disabled={pending || text.trim() === ""} onClick={submit}>
              {pending ? t("dialog.submitting") : t("dialog.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
