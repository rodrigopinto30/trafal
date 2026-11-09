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
import { moderateContentAction, resolveReportAction, takeReportAction, type AdminResult } from "@/lib/admin/actions";
import { ADMIN_ERROR_KEYS, MODERATION_NOTE_MAX, type AdminErrorKey, type ModerationTarget } from "@/lib/validation/admin-rules";

type Mode = "dismiss" | "handled" | "hide" | "restore";

const DIALOG = {
  dismiss: { title: "reports.dialog.dismissTitle", text: "reports.dialog.dismissText" },
  handled: { title: "reports.dialog.handledTitle", text: "reports.dialog.handledText" },
  hide: { title: "reports.dialog.hideTitle", text: "reports.dialog.hideText" },
  restore: { title: "reports.dialog.restoreTitle", text: "reports.dialog.restoreText" },
} as const;

type Props = {
  reportId: string;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  targetType: "game" | "post" | "comment" | "profile";
  targetId: string;
  targetStatus: string | null;
};

function isErrorKey(value: string): value is AdminErrorKey {
  return (ADMIN_ERROR_KEYS as readonly string[]).includes(value);
}

/**
 * What an admin can do with a report: take it, dismiss it, mark it as handled, hide the reported content and resolve, or restore content
 * that was hidden. Every step asks for what the database needs (a reason that the author will read when the content is hidden or
 * restored); the database decides who may do any of it and writes the moderation log.
 */
export function ReportActions({ reportId, status, targetType, targetId, targetStatus }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const waiting = status === "open" || status === "reviewing";
  const canModerate = targetType !== "profile";
  const reasonRequired = mode === "hide" || mode === "restore";

  function describe(key: string) {
    return t(`errors.${isErrorKey(key) ? key : "generic"}`);
  }

  function close(open: boolean) {
    if (open) return;
    setMode(null);
    setText("");
    setMessage(undefined);
  }

  function finish(result: AdminResult, done: "taken" | "dismissed" | "handled" | "hidden" | "restored") {
    if (result.ok) {
      toast.success(t(`reports.done.${done}`));
      setMode(null);
      setText("");
      router.refresh();
      return;
    }
    setMessage(describe(result.error));
  }

  function take() {
    startTransition(async () => finish(await takeReportAction({ reportId }), "taken"));
  }

  function confirm() {
    setMessage(undefined);
    startTransition(async () => {
      if (mode === "dismiss") finish(await resolveReportAction({ reportId, outcome: "dismissed", note: text }), "dismissed");
      else if (mode === "handled") finish(await resolveReportAction({ reportId, outcome: "actioned", note: text }), "handled");
      else if (mode === "hide") finish(await resolveReportAction({ reportId, outcome: "hide_content", note: text }), "hidden");
      else if (mode === "restore") finish(await moderateContentAction({ targetType: targetType as ModerationTarget, targetId, action: "restore", reason: text }), "restored");
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <Button type="button" variant="outline" onClick={take} disabled={pending}>
            {t("reports.take")}
          </Button>
        ) : null}
        {waiting ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setMode("dismiss")}>
              {t("reports.dismiss")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("handled")}>
              {t("reports.markHandled")}
            </Button>
            {canModerate && targetStatus === "published" ? (
              <Button type="button" variant="destructive" onClick={() => setMode("hide")}>
                {t("reports.hide")}
              </Button>
            ) : null}
          </>
        ) : null}
        {canModerate && targetStatus === "hidden" ? (
          <Button type="button" variant="outline" onClick={() => setMode("restore")}>
            {t("reports.restore")}
          </Button>
        ) : null}
      </div>

      <Dialog open={mode !== null} onOpenChange={close}>
        <DialogContent closeLabel={t("reports.dialog.cancel")} className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{mode ? t(DIALOG[mode].title) : ""}</DialogTitle>
            <DialogDescription>{mode ? t(DIALOG[mode].text) : ""}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field
              id={`note-${reportId}`}
              label={reasonRequired ? t("reports.dialog.reasonLabel") : t("reports.dialog.noteLabel")}
              hint={t("reports.dialog.count", { count: Array.from(text).length, max: MODERATION_NOTE_MAX })}
            >
              {(control) => <Textarea {...control} value={text} rows={4} disabled={pending} onChange={(event) => setText(event.target.value)} />}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {t("reports.dialog.cancel")}
            </Button>
            <Button type="button" variant={mode === "hide" ? "destructive" : "default"} onClick={confirm} disabled={pending || (reasonRequired && text.trim() === "")}>
              {t("reports.dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
