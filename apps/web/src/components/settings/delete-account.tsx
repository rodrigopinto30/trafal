"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useLocale, useTranslations } from "@/i18n/client";
import { deleteAccountAction } from "@/lib/account/actions";
import type { ReauthMethod } from "@/lib/auth/reauth";
import { DELETE_SECRET_MAX } from "@/lib/validation/account-rules";
import { initialFormState } from "@/lib/forms";

/**
 * Deleting the account: a button that opens a confirmation where the person types their @username and proves it is them with their
 * password (or their email, for an account without a password). The button only enables when the username matches and the proof is
 * filled in (just a convenience: the server checks both again). The password is kept in state: React 19 empties uncontrolled fields
 * when an action ends, and it never comes back from the server.
 */
export function DeleteAccount({ username, method }: { username: string; method: ReauthMethod }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [secret, setSecret] = useState("");
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialFormState);
  const matches = typed.trim().replace(/^@/, "").toLowerCase() === username;

  return (
    <>
      <Button type="button" variant="destructive" size="lg" onClick={() => setOpen(true)}>
        {t("account.delete")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[480px]">
          <form action={formAction} noValidate className="grid gap-5">
            <input type="hidden" name="lang" value={locale} />
            <DialogHeader>
              <DialogTitle>{t("account.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("account.dialogText")}</DialogDescription>
            </DialogHeader>
            {state.status === "error" && state.message ? <FormMessage>{state.message}</FormMessage> : null}
            <Field id="delete-account-confirmation" label={t("account.confirmLabel", { username })} error={state.fieldErrors?.confirmation}>
              {(control) => (
                <Input
                  {...control}
                  name="confirmation"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              )}
            </Field>
            <Field
              id="delete-account-secret"
              label={method === "password" ? t("account.passwordLabel") : t("account.emailLabel")}
              hint={method === "password" ? t("account.passwordHint") : t("account.emailHint")}
              error={state.fieldErrors?.secret}
            >
              {(control) =>
                method === "password" ? (
                  <PasswordInput
                    {...control}
                    name="secret"
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    autoComplete="current-password"
                    maxLength={DELETE_SECRET_MAX}
                    showLabel={t("account.showPassword")}
                    hideLabel={t("account.hidePassword")}
                  />
                ) : (
                  <Input {...control} name="secret" type="email" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="email" inputMode="email" maxLength={DELETE_SECRET_MAX} />
                )
              }
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                {t("account.cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={pending || !matches || secret.trim() === ""}>
                {pending ? t("account.deleting") : t("account.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
