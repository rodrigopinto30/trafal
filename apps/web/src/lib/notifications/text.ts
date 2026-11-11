import type { Messages, Translator } from "@/i18n/translator";
import type { NotificationItem } from "./queries";

export type NotificationsTranslator = Translator<Messages["notifications"]>;

const SNIPPET_MAX = 140;
const snippet = (text: string) => (Array.from(text).length > SNIPPET_MAX ? `${Array.from(text).slice(0, SNIPPET_MAX).join("")}…` : text);

/** The one-line sentence of a notification («Ana comentó en Órbita»), in the language of the translator. */
export function notificationSentence(item: NotificationItem, t: NotificationsTranslator): string {
  const who = item.actor?.display_name ?? t("someone");
  const title = item.game?.title ?? t("aGame");
  const place = item.game ? "game" : "post";
  switch (item.type) {
    case "comment":
      return t(`items.comment.${place}`, { who, title });
    case "reply":
      return t("items.reply", { who });
    case "like":
      return t(`items.like.${place}`, { who, title });
    case "follow":
      return t("items.follow", { who });
    case "helpful":
      return t("items.helpful", { who });
    case "version_ready":
      return t("items.versionReady", { version: item.version?.label ?? "", title });
    case "version_error":
      return t("items.versionError", { version: item.version?.label ?? "", title });
    case "moderation": {
      const action = item.data.action;
      if (action === "suspend") return t("items.moderation.suspend");
      if (action === "lift") return t("items.moderation.lift");
      const counter = item.data.kind === "counter_notice";
      if (action === "appeal_upheld") return t(counter ? "items.moderation.counterUpheld" : "items.moderation.appealUpheld");
      if (action === "appeal_overturned") return t(counter ? "items.moderation.counterOverturned" : "items.moderation.appealOverturned");
      const target = item.data.target_type === "game" || item.data.target_type === "post" || item.data.target_type === "comment" ? item.data.target_type : "game";
      return t(`items.moderation.${action === "restore" ? "restore" : "hide"}.${target}`);
    }
  }
}

/** The second line of a notification (the reason of a moderation notice, or the start of the comment), or null when there is none. */
export function notificationDetail(item: NotificationItem, t: NotificationsTranslator, formatDate: (date: Date) => string): string | null {
  if (item.type === "moderation") {
    const parts = [
      item.data.until ? t("until", { date: formatDate(new Date(item.data.until)) }) : null,
      item.data.reason ? t("reason", { reason: item.data.reason }) : null,
      item.data.note ? t("answer", { note: item.data.note }) : null,
    ];
    return parts.filter(Boolean).join(" · ") || null;
  }
  if ((item.type === "comment" || item.type === "reply" || item.type === "helpful") && item.comment) return `“${snippet(item.comment.body)}”`;
  return null;
}
