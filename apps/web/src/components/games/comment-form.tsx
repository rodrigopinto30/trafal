"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { addCommentAction } from "@/lib/games/comment-actions";
import { COMMENT_BODY_MAX, COMMENT_ERROR_KEYS, COMMENT_LABELS, type CommentErrorKey, type CommentTarget } from "@/lib/validation/comment";

type Props = {
  target: CommentTarget;
  id: string;
  parentId?: string;
  questionId?: string;
  replyToName?: string;
  signedIn: boolean;
  loginHref: string;
  onDone?: () => void;
  autoFocus?: boolean;
};

function isErrorKey(value: string): value is CommentErrorKey {
  return (COMMENT_ERROR_KEYS as readonly string[]).includes(value);
}

/**
 * Form to comment on a game or an update, or to reply to a comment (a reply has no label). Someone without an account is invited
 * to log in and comes back to the same page. The text is checked again by the server and the database has the last word.
 */
export function CommentForm({ target, id, parentId, questionId, replyToName, signedIn, loginHref, onDone, autoFocus = false }: Props) {
  const t = useTranslations("comments");
  const router = useRouter();
  const isReply = parentId !== undefined;
  const isAnswer = questionId !== undefined;
  const withoutLabel = isReply || isAnswer;
  const fieldId = `comment-${isReply ? parentId : isAnswer ? questionId : `${target}-${id}`}`;
  const [body, setBody] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Button asChild variant="outline">
        <Link href={loginHref}>{isReply ? t("loginToReply") : t("loginToComment")}</Link>
      </Button>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(undefined);
    startTransition(async () => {
      const result = await addCommentAction({ target, id, parentId: parentId ?? null, questionId: questionId ?? null, label: withoutLabel ? "" : label, body });
      if (result.ok) {
        setBody("");
        setLabel("");
        toast.success(isReply ? t("replied") : isAnswer ? t("answered") : t("posted"));
        router.refresh();
        onDone?.();
        return;
      }
      setError(t(`errors.${isErrorKey(result.error) ? result.error : "generic"}`));
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Field id={fieldId} label={replyToName ? t("replyTo", { name: replyToName }) : isAnswer ? t("answerLabel") : t("bodyLabel")} hint={t("bodyCount", { count: Array.from(body).length, max: COMMENT_BODY_MAX })} error={undefined}>
        {(control) => <Textarea {...control} value={body} rows={withoutLabel ? 3 : 4} placeholder={t("placeholder")} autoFocus={autoFocus} disabled={pending} onChange={(event) => setBody(event.target.value)} />}
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        {withoutLabel ? null : (
          <Field id={`${fieldId}-label`} label={t("label")} className="min-w-48">
            {(control) => (
              <NativeSelect {...control} value={label} disabled={pending} onChange={(event) => setLabel(event.target.value)}>
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
        <Button type="submit" disabled={pending}>
          {isReply ? t("replySubmit") : isAnswer ? t("answerSubmit") : t("submit")}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
