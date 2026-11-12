/** What a notification stores when it is read: reading it also sees it, so it never counts as new on the bell again. */
export function readMarkNow(): { read_at: string; seen_at: string } {
  const now = new Date().toISOString();
  return { read_at: now, seen_at: now };
}
