const MAX_PATH_LENGTH = 400;
const FORBIDDEN = /[\u0000-\u001f\u007f\\]/;

/**
 * File of a game requested by a URL path, or null if the path is not acceptable. «/» is the version's entry file and a path
 * ending in «/» is that folder's index.html. Encoded tricks (%2e%2e, %2f, %5c, %00) are decoded first and then rejected; the
 * URL parser has already collapsed plain «..» segments.
 */
export function resolveObjectPath(pathname: string, entryPath: string): string | null {
  if (!pathname.startsWith("/") || pathname.length > MAX_PATH_LENGTH) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (FORBIDDEN.test(decoded)) return null;
  const relative = decoded.slice(1);
  if (relative === "") return entryPath;
  const withIndex = relative.endsWith("/") ? `${relative}index.html` : relative;
  const segments = withIndex.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  return withIndex;
}
