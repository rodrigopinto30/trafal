import type { NotificationItem } from "./queries";

type Target = Pick<NotificationItem, "type" | "data" | "actor" | "game" | "post" | "comment">;

/** Where a notification leads: the game, the update, the profile or the screen it is about; null when there is nowhere to go (an account notice, or something that no longer exists). */
export function notificationHref(item: Target): string | null {
  if (item.type === "follow") return item.actor ? `/u/${item.actor.username}` : null;
  if (item.type === "version_ready" || item.type === "version_error") return item.game ? `/games/${item.game.public_id}/manage` : null;
  if (item.type === "moderation" && item.data.target_type === "profile") return null;
  if (item.game) return `/games/${item.game.public_id}`;
  if (item.post) return `/posts/${item.post.id}`;
  if (item.comment?.game) return `/games/${item.comment.game.public_id}`;
  if (item.comment?.post_id) return `/posts/${item.comment.post_id}`;
  return null;
}
