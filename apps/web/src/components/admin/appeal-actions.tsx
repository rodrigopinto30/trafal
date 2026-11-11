"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/i18n/client";
import { resolveAppealAction } from "@/lib/admin/actions";
import { ADMIN_ERROR_KEYS, MODERATION_NOTE_MAX, type AdminErrorKey } from "@/lib/validation/admin-rules";
import type { AppealOutcome, AppealTarget } from "@/lib/validation/appeal-rules";

function isErrorKey(value: string): value is AdminErrorKey {
  return (ADMIN_ERROR_KEYS as readonly string[]).includes(value);
}

/** The two answers to an appeal: keep the decision or reverse it. Both need an answer that the person reads; the database decides who may and logs it. */
export function AppealActions({ appealId, targetType }: { appealId: string; targetType: AppealTarget }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [outcome, setOutcome] = useState<AppealOutcome | null>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function close(open: boolean) {
    if (open || pending) return;
    setOutcome(null);
    setText("");
    setMessage(undefined);
  }

  function confirm() {
    if (!outcome) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await resolveAppealAction({ appealId, outcome, note: text });
      if (result.ok) {
        toast.success(t(`appeals.done.${outcome}`));
        setOutcome(null);
        setText("");
        router.refresh();
        return;
      }
      setMessage(t(`errors.${isErrorKey(result.error) ? result.error : "generic"}`));
    });
  }

  const overturnedText = targetType === "profile" ? t("appeals.dialog.overturnedProfileText") : t("appeals.dialog.overturnedContentText");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={() => setOutcome("upheld")}>
          {t("appeals.actions.upheld")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOutcome("overturned")}>
          {t("appeals.actions.overturned")}
        </Button>
      </div>

      <Dialog open={outcome !== null} onOpenChange={close}>
        <DialogContent closeLabel={t("appeals.dialog.cancel")} className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{outcome === "overturned" ? t("appeals.dialog.overturnedTitle") : t("appeals.dialog.upheldTitle")}</DialogTitle>
            <DialogDescription>{outcome === "overturned" ? overturnedText : t("appeals.dialog.upheldText")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field id={`appeal-note-${appealId}`} label={t("appeals.dialog.noteLabel")} hint={t("appeals.dialog.count", { count: Array.from(text).length, max: MODERATION_NOTE_MAX })}>
              {(control) => <Textarea {...control} value={text} rows={4} disabled={pending} onChange={(event) => setText(event.target.value)} />}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {t("appeals.dialog.cancel")}
            </Button>
            <Button type="button" onClick={confirm} disabled={pending || text.trim() === ""}>
              {t("appeals.dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
