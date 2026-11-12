"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { NotificationActions } from "@/components/notifications/notification-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { deleteNotificationsAction, setNotificationsReadAction, type NotificationResult } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

/** One notification of the screen, already in the person's language: the page resolves the sentences on the server. */
export type NotificationRow = {
  id: string;
  text: string;
  detail: string | null;
  href: string | null;
  createdAt: string;
  when: string;
  unread: boolean;
  offersAppeal: boolean;
};

/**
 * The notifications of one page with a checkbox on each, like a mailbox: select some (or all of the page) and mark them as read or
 * unread, or delete them. Deleting asks to confirm first because it cannot be undone. Unread ones are highlighted until they are
 * opened or marked as read, whether or not the bell already showed them.
 */
export function NotificationList({ rows }: { rows: NotificationRow[] }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const visibleIds = new Set(rows.map((row) => row.id));
  const chosen = rows.filter((row) => selected.has(row.id) && visibleIds.has(row.id));
  const allChosen = rows.length > 0 && chosen.length === rows.length;
  const anyUnread = chosen.some((row) => row.unread);
  const anyRead = chosen.some((row) => !row.unread);

  function toggle(id: string, on: boolean) {
    setConfirmingDelete(false);
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(on: boolean) {
    setConfirmingDelete(false);
    setSelected(on ? new Set(rows.map((row) => row.id)) : new Set());
  }

  function run(action: () => Promise<NotificationResult>, doneMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(t("error"));
        return;
      }
      setSelected(new Set());
      setConfirmingDelete(false);
      toast.success(doneMessage);
      router.refresh();
    });
  }

  const ids = chosen.map((row) => row.id);

  return (
    <div className="grid gap-3">
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl border border-white/8 bg-card px-4 py-1">
        <label className="flex items-center gap-3 text-sm text-text-2">
          <Checkbox checked={allChosen} onChange={(event) => toggleAll(event.target.checked)} disabled={pending} aria-label={t("selectAll")} />
          <span aria-live="polite">{chosen.length > 0 ? t("selectedCount", { count: chosen.length }) : t("selectAll")}</span>
        </label>
        {chosen.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("selectionActions")}>
            {anyUnread ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => setNotificationsReadAction({ ids, read: true }), t("markedRead", { count: ids.length }))}>
                {t("markSelectedRead")}
              </Button>
            ) : null}
            {anyRead ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => setNotificationsReadAction({ ids, read: false }), t("markedUnread", { count: ids.length }))}>
                {t("markSelectedUnread")}
              </Button>
            ) : null}
            {confirmingDelete ? (
              <>
                <span className="px-2 text-sm font-semibold text-foreground">{t("confirmDelete", { count: ids.length })}</span>
                <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => deleteNotificationsAction({ ids }), t("deleted", { count: ids.length }))}>
                  {t("confirmDeleteYes")}
                </Button>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirmingDelete(false)}>
                  {t("cancel")}
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirmingDelete(true)}>
                {t("deleteSelected")}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <ul className="grid gap-3">
        {rows.map((row) => {
          const isSelected = selected.has(row.id);
          return (
            <li key={row.id}>
              <article className={cn("grid gap-2 rounded-3xl border bg-card p-5", row.unread ? "border-cyan/40" : "border-white/8", isSelected && "bg-white/6")}>
                <div className="flex items-start gap-3">
                  <Checkbox checked={isSelected} onChange={(event) => toggle(row.id, event.target.checked)} disabled={pending} aria-label={t("selectOne", { text: row.text })} />
                  {row.unread ? <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-cyan" /> : <span aria-hidden="true" className="mt-2 size-2.5 shrink-0" />}
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className={cn("break-words", row.unread ? "font-semibold text-foreground" : "text-text-2")}>
                      {row.unread ? <span className="sr-only">{t("unread")}: </span> : null}
                      {row.href ? (
                        <a href={row.href} className="rounded-sm hover:text-cyan hover:underline focus-visible:ring-2 focus-visible:ring-cyan focus-visible:outline-none">
                          {row.text}
                        </a>
                      ) : (
                        row.text
                      )}
                    </p>
                    {row.detail ? <p className="text-sm break-words whitespace-pre-line text-text-2">{row.detail}</p> : null}
                    {row.offersAppeal ? (
                      <Link href="/settings/moderation" className="w-fit text-sm font-semibold text-cyan underline underline-offset-2 hover:text-white">
                        {t("appealLink")}
                      </Link>
                    ) : null}
                    <time dateTime={row.createdAt} className="text-xs text-text-3">
                      {row.when}
                    </time>
                  </div>
                </div>
                <NotificationActions id={row.id} read={!row.unread} />
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
