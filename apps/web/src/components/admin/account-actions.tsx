"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/i18n/client";
import { liftSuspensionAction, suspendAccountAction, type AdminResult } from "@/lib/admin/actions";
import { ADMIN_ERROR_KEYS, SUSPENSION_DURATIONS, SUSPENSION_REASON_MAX, type AdminErrorKey } from "@/lib/validation/admin-rules";

type Props = { userId: string; username: string; suspended: boolean };

function isErrorKey(value: string): value is AdminErrorKey {
  return (ADMIN_ERROR_KEYS as readonly string[]).includes(value);
}

/**
 * Suspend an account (with a reason the person reads and how long it lasts) or lift its suspension (with a reason). The database
 * decides: it refuses administration accounts and oneself, and it writes the moderation log and tells the person.
 */
export function AccountActions({ userId, username, suspended }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<(typeof SUSPENSION_DURATIONS)[number]>("7");
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setReason("");
      setMessage(undefined);
    }
  }

  function finish(result: AdminResult) {
    if (result.ok) {
      toast.success(t(suspended ? "accounts.done.lifted" : "accounts.done.suspended"));
      close(false);
      router.refresh();
      return;
    }
    setMessage(t(`errors.${isErrorKey(result.error) ? result.error : "generic"}`));
  }

  function confirm() {
    setMessage(undefined);
    startTransition(async () => finish(suspended ? await liftSuspensionAction({ userId, reason }) : await suspendAccountAction({ userId, reason, duration })));
  }

  return (
    <>
      <Button type="button" variant={suspended ? "outline" : "destructive"} onClick={() => setOpen(true)}>
        {suspended ? t("accounts.lift") : t("accounts.suspend")}
        <span className="sr-only"> @{username}</span>
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent closeLabel={t("accounts.dialog.cancel")} className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t(suspended ? "accounts.dialog.liftTitle" : "accounts.dialog.suspendTitle", { username })}</DialogTitle>
            <DialogDescription>{t(suspended ? "accounts.dialog.liftText" : "accounts.dialog.suspendText")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {message ? <FormMessage>{message}</FormMessage> : null}
            {suspended ? null : (
              <Field id={`duration-${userId}`} label={t("accounts.dialog.durationLabel")}>
                {(control) => (
                  <NativeSelect {...control} value={duration} disabled={pending} onChange={(event) => setDuration(event.target.value as typeof duration)}>
                    {SUSPENSION_DURATIONS.map((value) => (
                      <option key={value} value={value}>
                        {t(`accounts.dialog.durations.${value}`)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            )}
            <Field id={`reason-${userId}`} label={t("accounts.dialog.reasonLabel")} hint={t("accounts.dialog.count", { count: Array.from(reason).length, max: SUSPENSION_REASON_MAX })}>
              {(control) => <Textarea {...control} value={reason} rows={4} disabled={pending} onChange={(event) => setReason(event.target.value)} />}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {t("accounts.dialog.cancel")}
            </Button>
            <Button type="button" variant={suspended ? "default" : "destructive"} onClick={confirm} disabled={pending || reason.trim() === ""}>
              {t("accounts.dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
