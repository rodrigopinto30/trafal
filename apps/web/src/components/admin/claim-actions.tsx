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
import { moderateContentAction, resolveClaimAction, takeClaimAction, type AdminResult } from "@/lib/admin/actions";
import { ADMIN_ERROR_KEYS, MODERATION_NOTE_MAX, type AdminErrorKey } from "@/lib/validation/admin-rules";

type Mode = "dismiss" | "handled" | "hide" | "restoreGame" | "restorePost";

const DIALOG = {
  dismiss: { title: "claims.dialog.dismissTitle", text: "claims.dialog.dismissText" },
  handled: { title: "claims.dialog.handledTitle", text: "claims.dialog.handledText" },
  hide: { title: "claims.dialog.hideTitle", text: "claims.dialog.hideText" },
  restoreGame: { title: "claims.dialog.restoreGameTitle", text: "claims.dialog.restoreText" },
  restorePost: { title: "claims.dialog.restorePostTitle", text: "claims.dialog.restoreText" },
} as const;

type Props = {
  claimId: string;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  game: { id: string; status: string } | null;
  post: { id: string; status: string } | null;
};

function isErrorKey(value: string): value is AdminErrorKey {
  return (ADMIN_ERROR_KEYS as readonly string[]).includes(value);
}

/**
 * What an admin can do with a copyright claim: take it, dismiss it, mark it as handled, hide what was claimed and resolve, or put back
 * what was hidden. Hiding and restoring ask for a reason that the author reads; the database decides who may do any of it and logs it.
 */
export function ClaimActions({ claimId, status, game, post }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [taking, startTaking] = useTransition();

  const waiting = status === "open" || status === "reviewing";
  const canHide = waiting && (game?.status === "published" || post?.status === "published");
  const reasonRequired = mode === "hide" || mode === "restoreGame" || mode === "restorePost";

  function close(open: boolean) {
    if (open) return;
    setMode(null);
    setText("");
    setMessage(undefined);
  }

  function finish(result: AdminResult, done: "taken" | "dismissed" | "handled" | "hidden" | "restored") {
    if (result.ok) {
      toast.success(t(`claims.done.${done}`));
      close(false);
      router.refresh();
      return;
    }
    setMessage(t(`errors.${isErrorKey(result.error) ? result.error : "generic"}`));
  }

  function confirm() {
    setMessage(undefined);
    startTransition(async () => {
      if (mode === "dismiss") finish(await resolveClaimAction({ claimId, outcome: "dismissed", note: text }), "dismissed");
      else if (mode === "handled") finish(await resolveClaimAction({ claimId, outcome: "actioned", note: text }), "handled");
      else if (mode === "hide") finish(await resolveClaimAction({ claimId, outcome: "hide_content", note: text }), "hidden");
      else if (mode === "restoreGame" && game) finish(await moderateContentAction({ targetType: "game", targetId: game.id, action: "restore", reason: text }), "restored");
      else if (mode === "restorePost" && post) finish(await moderateContentAction({ targetType: "post", targetId: post.id, action: "restore", reason: text }), "restored");
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <Button type="button" variant="outline" disabled={taking} onClick={() => startTaking(async () => finish(await takeClaimAction({ claimId }), "taken"))}>
            {t("claims.take")}
          </Button>
        ) : null}
        {waiting ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setMode("dismiss")}>
              {t("claims.dismiss")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("handled")}>
              {t("claims.markHandled")}
            </Button>
          </>
        ) : null}
        {canHide ? (
          <Button type="button" variant="destructive" onClick={() => setMode("hide")}>
            {t("claims.hide")}
          </Button>
        ) : null}
        {game?.status === "hidden" ? (
          <Button type="button" variant="outline" onClick={() => setMode("restoreGame")}>
            {t("claims.restoreGame")}
          </Button>
        ) : null}
        {post?.status === "hidden" ? (
          <Button type="button" variant="outline" onClick={() => setMode("restorePost")}>
            {t("claims.restorePost")}
          </Button>
        ) : null}
      </div>

      <Dialog open={mode !== null} onOpenChange={close}>
        <DialogContent closeLabel={t("claims.dialog.cancel")} className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{mode ? t(DIALOG[mode].title) : ""}</DialogTitle>
            <DialogDescription>{mode ? t(DIALOG[mode].text) : ""}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field id={`claim-note-${claimId}`} label={reasonRequired ? t("claims.dialog.reasonLabel") : t("claims.dialog.noteLabel")} hint={t("claims.dialog.count", { count: Array.from(text).length, max: MODERATION_NOTE_MAX })}>
              {(control) => <Textarea {...control} value={text} rows={4} disabled={pending} onChange={(event) => setText(event.target.value)} />}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {t("claims.dialog.cancel")}
            </Button>
            <Button type="button" variant={mode === "hide" ? "destructive" : "default"} onClick={confirm} disabled={pending || (reasonRequired && text.trim() === "")}>
              {t("claims.dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
