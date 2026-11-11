const MAX_SHOWN = 99;

/**
 * The text of the unread badge, capped so it stays small. The accessible name of the bell must use this same text: a screen reader
 * (and the accessibility audit) expects the visible text to be part of the name.
 */
export function unreadBadgeText(count: number): string {
  return count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);
}
