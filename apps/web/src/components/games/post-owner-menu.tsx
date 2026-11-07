"use client";

import { MoreVerticalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormMessage } from "@/components/ui/form-message";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { deletePostAction } from "@/lib/games/post-actions";
import { POST_ERROR_KEYS, type PostErrorKey } from "@/lib/validation/post";

function isErrorKey(value: string): value is PostErrorKey {
  return (POST_ERROR_KEYS as readonly string[]).includes(value);
}

/** «Edit» (a page of its own, where everything can change) and «Delete» (with a confirmation) of the author's own update. Only the author is given this menu; the database enforces it. */
export function PostOwnerMenu({ postId }: { postId: string }) {
  const t = useTranslations("postForm");
  const tc = useTranslations("common");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function close(open: boolean) {
    if (open) return;
    setConfirming(false);
    setMessage(undefined);
  }

  function remove() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await deletePostAction(postId);
      if (result.ok) {
        setConfirming(false);
        toast.success(t("manage.deleted"));
        router.refresh();
        return;
      }
      setMessage(t(`errors.${isErrorKey(result.error) ? result.error : "generic"}`));
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
          <DropdownMenuItem asChild>
            <Link href={`/posts/${postId}/edit`}>{t("manage.edit")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirming(true)}>{t("manage.delete")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={close}>
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
