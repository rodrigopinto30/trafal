"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";
import { deleteNotificationAction, markAllNotificationsReadAction, markNotificationReadAction, type NotificationResult } from "@/lib/notifications/actions";

/** «Mark as read» and «Dismiss» of one notification. The database only lets people change their own. */
export function NotificationActions({ id, read }: { id: string; read: boolean }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<NotificationResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) router.refresh();
      else toast.error(t("error"));
    });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {read ? null : (
        <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => markNotificationReadAction({ id }))}>
          {t("markRead")}
        </Button>
      )}
      <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => deleteNotificationAction({ id }))}>
        {t("dismiss")}
      </Button>
    </div>
  );
}

/** «Mark all as read». */
export function MarkAllReadButton() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsReadAction();
          if (result.ok) {
            toast.success(t("allRead"));
            router.refresh();
          } else toast.error(t("error"));
        })
      }
    >
      {t("markAllRead")}
    </Button>
  );
}
