/**
 * The provider sign-in address as the browser has to open it. Inside Docker the server reaches Supabase on its internal
 * address (SUPABASE_INTERNAL_URL) and Supabase Auth builds the address from it, but the browser only knows the public one.
 * Any other address (already public, or another host) is left as it is.
 */
export function browserAuthUrl(url: string, internalBase: string, publicBase: string): string {
  try {
    const target = new URL(url);
    if (!internalBase || !publicBase || target.origin !== new URL(internalBase).origin) return url;
    return new URL(`${target.pathname}${target.search}${target.hash}`, publicBase).toString();
  } catch {
    return url;
  }
}
