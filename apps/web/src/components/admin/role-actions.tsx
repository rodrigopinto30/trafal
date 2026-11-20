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
import { setAccountRoleAction, type AdminResult } from "@/lib/admin/actions";
import { ADMIN_ERROR_KEYS, ROLE_REASON_MAX, type AccountRole, type AdminErrorKey } from "@/lib/validation/admin-rules";

type Props = { userId: string; username: string; role: AccountRole };

function isErrorKey(value: string): value is AdminErrorKey {
  return (ADMIN_ERROR_KEYS as readonly string[]).includes(value);
}

/**
 * Name an account as admin, or take the role away, with a reason the person reads. The database decides: it refuses one's own
 * role and a suspended account, and it writes the moderation log and tells the person.
 */
export function RoleActions({ userId, username, role }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const granting = role === "user";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
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
      toast.success(t(granting ? "accounts.done.granted" : "accounts.done.revoked"));
      close(false);
      router.refresh();
      return;
    }
    setMessage(t(`errors.${isErrorKey(result.error) ? result.error : "generic"}`));
  }

  function confirm() {
    setMessage(undefined);
    startTransition(async () => finish(await setAccountRoleAction({ userId, role: granting ? "admin" : "user", reason })));
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {granting ? t("accounts.grant") : t("accounts.revoke")}
        <span className="sr-only"> @{username}</span>
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent closeLabel={t("accounts.dialog.cancel")} className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t(granting ? "accounts.dialog.grantTitle" : "accounts.dialog.revokeTitle", { username })}</DialogTitle>
            <DialogDescription>{t(granting ? "accounts.dialog.grantText" : "accounts.dialog.revokeText")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field id={`role-reason-${userId}`} label={t("accounts.dialog.reasonLabel")} hint={t("accounts.dialog.count", { count: Array.from(reason).length, max: ROLE_REASON_MAX })}>
              {(control) => <Textarea {...control} value={reason} rows={4} disabled={pending} onChange={(event) => setReason(event.target.value)} />}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {t("accounts.dialog.cancel")}
            </Button>
            <Button type="button" onClick={confirm} disabled={pending || reason.trim() === ""}>
              {t("accounts.dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
