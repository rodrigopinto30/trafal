import type { NotificationItem } from "./queries";

type Target = Pick<NotificationItem, "type" | "data" | "actor" | "game" | "post" | "comment">;

export const COMMENT_ANCHOR_PREFIX = "comment-";

/** The address fragment of a comment: every comment on a page has this as its id, so a link can land on it. */
export const commentAnchor = (commentId: string) => `#${COMMENT_ANCHOR_PREFIX}${commentId}`;

function page(item: Target): string | null {
  if (item.game) return `/games/${item.game.public_id}`;
  if (item.post) return `/posts/${item.post.id}`;
  if (item.comment?.game) return `/games/${item.comment.game.public_id}`;
  if (item.comment?.post_id) return `/posts/${item.comment.post_id}`;
  return null;
}

/**
 * Where a notification leads: the game, the update, the profile or the screen it is about (and, for what is about a comment, the
 * comment itself); null when there is nowhere to go (an account notice, or something that no longer exists).
 */
export function notificationHref(item: Target): string | null {
  if (item.type === "follow") return item.actor ? `/u/${item.actor.username}` : null;
  if (item.type === "version_ready" || item.type === "version_error") return item.game ? `/games/${item.game.public_id}/manage` : null;
  if (item.type === "moderation" && item.data.target_type === "profile") return null;
  const path = page(item);
  if (!path) return null;
  const aboutAComment = item.type === "comment" || item.type === "reply" || item.type === "helpful" || (item.type === "moderation" && item.data.target_type === "comment");
  return item.comment && aboutAComment ? `${path}${commentAnchor(item.comment.id)}` : path;
}
