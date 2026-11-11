"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { submitCounterNoticeAction } from "@/lib/appeals/actions";
import { APPEAL_MESSAGE_MAX, COUNTER_NOTICE_EMAIL_MAX, COUNTER_NOTICE_NAME_MAX } from "@/lib/validation/appeal-rules";

/** «Send a counter-notice» button for a game or an update hidden because of a copyright claim, and its dialog. */
export function CounterNoticeButton({ targetType, targetId }: { targetType: "game" | "post"; targetId: string }) {
  const t = useTranslations("appeals");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setText("");
    setName("");
    setEmail("");
    setGoodFaith(false);
    setAccuracy(false);
    setMessage(null);
  }

  function close(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) reset();
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitCounterNoticeAction({ targetType, targetId, message: text, name, email, goodFaith, accuracy }, locale);
      if (result.ok) {
        toast.success(t("counter.sent"));
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  const ready = text.trim() !== "" && name.trim() !== "" && email.trim() !== "" && goodFaith && accuracy;

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t("counter.button")}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent closeLabel={tc("close")} className="max-h-[92svh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("counter.title")}</DialogTitle>
            <DialogDescription>{t("counter.text")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field id={`counter-message-${targetId}`} label={t("counter.message")} hint={t("dialog.hint", { max: APPEAL_MESSAGE_MAX })}>
              {(control) => <Textarea {...control} value={text} maxLength={APPEAL_MESSAGE_MAX} rows={4} onChange={(event) => setText(event.target.value)} />}
            </Field>
            <Field id={`counter-name-${targetId}`} label={t("counter.name")}>
              {(control) => <Input {...control} value={name} maxLength={COUNTER_NOTICE_NAME_MAX} autoComplete="name" onChange={(event) => setName(event.target.value)} />}
            </Field>
            <Field id={`counter-email-${targetId}`} label={t("counter.email")} hint={t("counter.privacy")}>
              {(control) => <Input {...control} type="email" value={email} maxLength={COUNTER_NOTICE_EMAIL_MAX} autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} />}
            </Field>
            <div className="flex items-start gap-3">
              <Checkbox id={`counter-good-faith-${targetId}`} checked={goodFaith} onChange={(event) => setGoodFaith(event.target.checked)} className="mt-0.5" />
              <Label htmlFor={`counter-good-faith-${targetId}`} className="block font-normal text-text-2">
                {t("counter.goodFaith")}
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id={`counter-accuracy-${targetId}`} checked={accuracy} onChange={(event) => setAccuracy(event.target.checked)} className="mt-0.5" />
              <Label htmlFor={`counter-accuracy-${targetId}`} className="block font-normal text-text-2">
                {t("counter.accuracy")}
              </Label>
            </div>
            <Button type="button" size="lg" disabled={pending || !ready} onClick={submit}>
              {pending ? t("dialog.submitting") : t("counter.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
