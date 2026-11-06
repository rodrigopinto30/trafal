const PUBLIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PUBLIC_ID_LENGTH = 40;

/**
 * Game id from a Host header: «<public_id>.<games domain>[:port]» gives the id; anything else (the bare domain, another
 * domain, nested subdomains, odd characters) gives null.
 */
export function publicIdFromHost(hostHeader: string | null, gamesDomain: string): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.toLowerCase().replace(/:\d+$/, "");
  const suffix = `.${gamesDomain.toLowerCase()}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  return label.length > 0 && label.length <= MAX_PUBLIC_ID_LENGTH && PUBLIC_ID.test(label) ? label : null;
}
