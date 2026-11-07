"use client";

import { MoreVerticalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/i18n/client";
import { deletePostAction, updatePostAction } from "@/lib/games/post-actions";
import { POST_BODY_MAX, POST_HIGHLIGHT_MAX, POST_ERROR_KEYS, type PostErrorKey } from "@/lib/validation/post";

type Props = { postId: string; kind: string; body: string; highlight: string | null };

function isErrorKey(value: string): value is PostErrorKey {
  return (POST_ERROR_KEYS as readonly string[]).includes(value);
}

/** «Edit» and «Delete» of the author's own update, with a dialog for each. Only the author is given this menu; the database enforces it. */
export function PostOwnerMenu({ postId, kind, body, highlight }: Props) {
  const t = useTranslations("postForm");
  const tc = useTranslations("common");
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [text, setText] = useState(body);
  const [highlightText, setHighlightText] = useState(highlight ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const describe = (key: string) => t(`errors.${isErrorKey(key) ? key : "generic"}`);

  function close(open: boolean) {
    if (open) return;
    setDialog(null);
    setText(body);
    setHighlightText(highlight ?? "");
    setFieldErrors({});
    setMessage(undefined);
  }

  function save() {
    setFieldErrors({});
    setMessage(undefined);
    startTransition(async () => {
      const result = await updatePostAction({ id: postId, body: text, highlight: highlightText });
      if (result.ok) {
        setDialog(null);
        toast.success(t("manage.saved"));
        router.refresh();
        return;
      }
      if (result.field && result.field !== "form") setFieldErrors({ [result.field]: describe(result.error) });
      else setMessage(describe(result.error));
    });
  }

  function remove() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await deletePostAction(postId);
      if (result.ok) {
        setDialog(null);
        toast.success(t("manage.deleted"));
        router.refresh();
        return;
      }
      setMessage(describe(result.error));
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={t("manage.menu")}>
            <MoreVerticalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>{t("manage.edit")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("delete")}>{t("manage.delete")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "edit"} onOpenChange={close}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("manage.editTitle")}</DialogTitle>
            <DialogDescription>{t("manage.editHelp")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Field id={`edit-body-${postId}`} label={t("fields.body")} hint={t("fields.bodyCount", { count: Array.from(text).length, max: POST_BODY_MAX })} error={fieldErrors.body}>
              {(control) => <Textarea {...control} value={text} rows={6} onChange={(event) => setText(event.target.value)} />}
            </Field>
            {kind === "hito" ? (
              <Field id={`edit-highlight-${postId}`} label={t("fields.highlight")} hint={t("fields.highlightHint")} error={fieldErrors.highlight}>
                {(control) => <Input {...control} value={highlightText} maxLength={POST_HIGHLIGHT_MAX} autoComplete="off" onChange={(event) => setHighlightText(event.target.value)} />}
              </Field>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {t("manage.cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {t("manage.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={close}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("manage.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("manage.deleteText")}</DialogDescription>
          </DialogHeader>
          {message ? <FormMessage>{message}</FormMessage> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {t("manage.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              {t("manage.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
