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
import { reportGameAction } from "@/lib/games/report-actions";
import { REPORT_DETAIL_MAX, REPORT_REASONS } from "@/lib/validation/report-rules";

type Props = { gameId: string; publicId: string; signedIn: boolean };

/** «Report» button of the player and its dialog. Visitors are asked to log in first. */
export function ReportGameDialog({ gameId, publicId, signedIn }: Props) {
  const t = useTranslations("gamePlayer");
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
      const result = await reportGameAction({ gameId, reason, detail }, locale);
      if (result.ok) setSent(true);
      else setMessage(result.message);
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <FlagIcon aria-hidden="true" />
        {t("report.button")}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t("report.title")}</DialogTitle>
            <DialogDescription>{signedIn ? t("report.help") : t("report.loginHelp")}</DialogDescription>
          </DialogHeader>
          {!signedIn ? (
            <Button asChild size="lg">
              <Link href={`/login?next=${encodeURIComponent(`/games/${publicId}`)}`}>{t("report.login")}</Link>
            </Button>
          ) : sent ? (
            <FormMessage tone="info">{t("report.sent")}</FormMessage>
          ) : (
            <div className="grid gap-5">
              {message ? <FormMessage>{message}</FormMessage> : null}
              <Field id="report-reason" label={t("report.reason")}>
                {(control) => (
                  <NativeSelect {...control} value={reason} onChange={(event) => setReason(event.target.value)}>
                    <option value="">{t("report.reasonPlaceholder")}</option>
                    {REPORT_REASONS.map((value) => (
                      <option key={value} value={value}>
                        {t(`report.reasons.${value}`)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field id="report-detail" label={t("report.detail")} hint={t("report.detailHint")}>
                {(control) => <Textarea {...control} value={detail} maxLength={REPORT_DETAIL_MAX} rows={4} onChange={(event) => setDetail(event.target.value)} />}
              </Field>
              <Button type="button" size="lg" disabled={pending || reason === ""} onClick={submit}>
                {pending ? t("report.sending") : t("report.submit")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
