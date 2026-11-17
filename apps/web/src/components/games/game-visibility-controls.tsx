"use client";

import { RocketIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { useLocale } from "@/i18n/client";
import { setGameVisibilityAction } from "@/lib/games/publish-actions";

export type GameVisibilityLabels = {
  publish: string;
  publishing: string;
  unpublish: string;
  unpublishing: string;
  published: string;
  unpublished: string;
  cancel: string;
  close: string;
  unpublishTitle: string;
  unpublishText: string;
  readyTitle: string;
  readyText: string;
  readyLater: string;
};

type Props = {
  gameId: string;
  published: boolean;
  /** The person just finished uploading this game: a dialog tells them it is ready and offers to publish it right away. */
  justUploaded?: boolean;
  labels: GameVisibilityLabels;
};

/**
 * The owner's "Publish game" / "Take game down" button. Publishing is one click (and is offered in a dialog right after an
 * upload); taking a game down asks first, because it disappears for everyone. The database decides: it refuses to publish a
 * game without a ready version and only lets the owner change it.
 */
export function GameVisibilityControls({ gameId, published, justUploaded = false, labels }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [readyOpen, setReadyOpen] = useState(justUploaded && !published);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!justUploaded) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  }, [justUploaded]);

  function change(next: "published" | "draft") {
    setMessage(null);
    startTransition(async () => {
      const result = await setGameVisibilityAction(gameId, next, locale);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setReadyOpen(false);
      setConfirming(false);
      toast.success(next === "published" ? labels.published : labels.unpublished);
      router.refresh();
    });
  }

  function closeDialogs(open: boolean) {
    if (open || pending) return;
    setReadyOpen(false);
    setConfirming(false);
    setMessage(null);
  }

  const dialogOpen = readyOpen || confirming;
  return (
    <>
      {published ? (
        <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => setConfirming(true)}>
          {labels.unpublish}
        </Button>
      ) : (
        <Button type="button" size="lg" disabled={pending} onClick={() => change("published")}>
          <RocketIcon aria-hidden="true" />
          {pending ? labels.publishing : labels.publish}
        </Button>
      )}
      {message && !dialogOpen ? <FormMessage className="basis-full">{message}</FormMessage> : null}

      <Dialog open={readyOpen} onOpenChange={closeDialogs}>
        <DialogContent closeLabel={labels.close} className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{labels.readyTitle}</DialogTitle>
            <DialogDescription>{labels.readyText}</DialogDescription>
          </DialogHeader>
          {message ? <FormMessage>{message}</FormMessage> : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="xl" onClick={() => closeDialogs(false)} disabled={pending}>
              {labels.readyLater}
            </Button>
            <Button type="button" size="xl" onClick={() => change("published")} disabled={pending}>
              <RocketIcon aria-hidden="true" />
              {pending ? labels.publishing : labels.publish}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={closeDialogs}>
        <DialogContent closeLabel={labels.close} className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{labels.unpublishTitle}</DialogTitle>
            <DialogDescription>{labels.unpublishText}</DialogDescription>
          </DialogHeader>
          {message ? <FormMessage>{message}</FormMessage> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeDialogs(false)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button type="button" variant="destructive" onClick={() => change("draft")} disabled={pending}>
              {pending ? labels.unpublishing : labels.unpublish}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
