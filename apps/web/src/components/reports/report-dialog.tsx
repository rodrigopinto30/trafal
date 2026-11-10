"use client";

import { FlagIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { reportContentAction } from "@/lib/reports/actions";
import { REPORT_DETAIL_MAX, REPORT_REASONS_BY_TARGET, type ReportTarget } from "@/lib/validation/report-rules";

type Props = {
  targetType: ReportTarget;
  targetId: string;
  signedIn: boolean;
  loginHref: string;
  /** «text» shows the word next to the flag; «icon» shows only the flag (the name is still there for screen readers). */
  display?: "text" | "icon";
};

/** «Report» button of a game, an update, a comment or a profile, and its dialog. Visitors are asked to log in first. */
export function ReportDialog({ targetType, targetId, signedIn, loginHref, display = "text" }: Props) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setMessage(null);
      setSent(false);
      setReason("");
      setDetail("");
    }
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await reportContentAction({ targetType, targetId, reason, detail }, locale);
      if (result.ok) setSent(true);
      else setMessage(result.message);
    });
  }

  return (
    <>
      {display === "icon" ? (
        <Button type="button" variant="ghost" size="icon" aria-label={t(`buttons.${targetType}`)} title={t(`buttons.${targetType}`)} onClick={() => setOpen(true)}>
          <FlagIcon aria-hidden="true" />
        </Button>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
          <FlagIcon aria-hidden="true" />
          {t("button")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t(`titles.${targetType}`)}</DialogTitle>
            <DialogDescription>{signedIn ? t(`help.${targetType}`) : t("loginHelp")}</DialogDescription>
          </DialogHeader>
          {!signedIn ? (
            <Button asChild size="lg">
              <Link href={loginHref}>{t("login")}</Link>
            </Button>
          ) : sent ? (
            <FormMessage tone="info">{t("sent")}</FormMessage>
          ) : (
            <div className="grid gap-5">
              {message ? <FormMessage>{message}</FormMessage> : null}
              <Field id={`report-reason-${targetId}`} label={t("reason")}>
                {(control) => (
                  <NativeSelect {...control} value={reason} onChange={(event) => setReason(event.target.value)}>
                    <option value="">{t("reasonPlaceholder")}</option>
                    {REPORT_REASONS_BY_TARGET[targetType].map((value) => (
                      <option key={value} value={value}>
                        {t(`reasons.${value}`)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field id={`report-detail-${targetId}`} label={t("detail")} hint={t("detailHint")}>
                {(control) => <Textarea {...control} value={detail} maxLength={REPORT_DETAIL_MAX} rows={4} onChange={(event) => setDetail(event.target.value)} />}
              </Field>
              <Button type="button" size="lg" disabled={pending || reason === ""} onClick={submit}>
                {pending ? t("sending") : t("submit")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
