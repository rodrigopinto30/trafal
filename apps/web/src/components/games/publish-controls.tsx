"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { useLocale } from "@/i18n/client";
import { setGameVisibilityAction } from "@/lib/games/publish-actions";

type Props = {
  gameId: string;
  published: boolean;
  publishLabel: string;
  unpublishLabel: string;
  pendingLabel: string;
};

/** Publish / back-to-draft button of the owner's game page. The server decides: the database rejects a game without a ready version. */
export function PublishControls({ gameId, published, publishLabel, unpublishLabel, pendingLabel }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function change() {
    setMessage(null);
    startTransition(async () => {
      const result = await setGameVisibilityAction(gameId, published ? "draft" : "published", locale);
      if (result.ok) router.refresh();
      else setMessage(result.message);
    });
  }

  return (
    <div className="grid gap-3">
      {message ? <FormMessage>{message}</FormMessage> : null}
      <div>
        <Button type="button" size="lg" variant={published ? "outline" : "default"} disabled={pending} onClick={change}>
          {pending ? pendingLabel : published ? unpublishLabel : publishLabel}
        </Button>
      </div>
    </div>
  );
}
