/** Asks search engines not to list the page (they still follow its links). For views that are the same page with other filters, and for private ones. */
export function NoIndex() {
  return <meta name="robots" content="noindex, follow" />;
}
