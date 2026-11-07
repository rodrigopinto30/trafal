"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CommentForm } from "@/components/games/comment-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/i18n/client";
import { deleteCommentAction, updateCommentAction } from "@/lib/games/comment-actions";
import { COMMENT_BODY_MAX, COMMENT_ERROR_KEYS, COMMENT_LABELS, type CommentErrorKey, type CommentTarget } from "@/lib/validation/comment";

type Props = {
  commentId: string;
  body: string;
  label: string | null;
  authorName: string;
  isReply: boolean;
  isOwn: boolean;
  target: CommentTarget;
  targetId: string;
  signedIn: boolean;
  loginHref: string;
};

function isErrorKey(value: string): value is CommentErrorKey {
  return (COMMENT_ERROR_KEYS as readonly string[]).includes(value);
}

/**
 * What a person can do with a comment: reply to it (only top-level comments get replies) and, when it is theirs, edit it or
 * delete it. Everything is enforced by the database; hiding the buttons from other people is a courtesy.
 */
export function CommentActions({ commentId, body, label, authorName, isReply, isOwn, target, targetId, signedIn, loginHref }: Props) {
  const t = useTranslations("comments");
  const tc = useTranslations("common");
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [text, setText] = useState(body);
  const [chosen, setChosen] = useState(label ?? "");
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const describe = (key: string) => t(`errors.${isErrorKey(key) ? key : "generic"}`);

  function closeDialog(open: boolean) {
    if (open) return;
    setDialog(null);
    setText(body);
    setChosen(label ?? "");
    setMessage(undefined);
  }

  function save() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await updateCommentAction({ id: commentId, body: text, label: isReply ? "" : chosen });
      if (result.ok) {
        setDialog(null);
        toast.success(t("saved"));
        router.refresh();
        return;
      }
      setMessage(describe(result.error));
    });
  }

  function remove() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await deleteCommentAction(commentId);
      if (result.ok) {
        setDialog(null);
        toast.success(t("deleted"));
        router.refresh();
        return;
      }
      setMessage(describe(result.error));
    });
  }

  return (
    <div className="mt-1 grid gap-3">
      <div className="flex flex-wrap items-center gap-x-2">
        {isReply ? null : (
          <Button type="button" variant="ghost" aria-expanded={replying} onClick={() => setReplying((open) => !open)}>
            {t("reply")}
          </Button>
        )}
        {isOwn ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setDialog("edit")}>
              {t("edit")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDialog("delete")}>
              {t("delete")}
            </Button>
          </>
        ) : null}
      </div>

      {replying ? (
        <CommentForm target={target} id={targetId} parentId={commentId} replyToName={authorName} signedIn={signedIn} loginHref={loginHref} onDone={() => setReplying(false)} autoFocus />
      ) : null}

      <Dialog open={dialog === "edit"} onOpenChange={closeDialog}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("editTitle")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field id={`edit-body-${commentId}`} label={t("bodyLabel")} hint={t("bodyCount", { count: Array.from(text).length, max: COMMENT_BODY_MAX })}>
              {(control) => <Textarea {...control} value={text} rows={5} disabled={pending} onChange={(event) => setText(event.target.value)} />}
            </Field>
            {isReply ? null : (
              <Field id={`edit-label-${commentId}`} label={t("label")}>
                {(control) => (
                  <NativeSelect {...control} value={chosen} disabled={pending} onChange={(event) => setChosen(event.target.value)}>
                    <option value="">{t("labels.none")}</option>
                    {COMMENT_LABELS.map((value) => (
                      <option key={value} value={value}>
                        {t(`labels.${value}`)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeDialog(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={closeDialog}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{isReply ? t("deleteReplyText") : t("deleteText")}</DialogDescription>
          </DialogHeader>
          {message ? <FormMessage>{message}</FormMessage> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeDialog(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
