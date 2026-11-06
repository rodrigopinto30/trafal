/**
 * Address of a game's frame: <public_id> as a subdomain of the games domain (http://games.localhost:4000 gives
 * http://orbita.games.localhost:4000/). Null if the games domain is not configured or the id has an odd shape: the player
 * then shows the game as unavailable instead of building a strange address.
 */
export function gameFrameUrl(gamesBaseUrl: string, publicId: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicId) || publicId.length > 40) return null;
  try {
    const base = new URL(gamesBaseUrl);
    if (base.protocol !== "http:" && base.protocol !== "https:") return null;
    return `${base.protocol}//${publicId}.${base.host}/`;
  } catch {
    return null;
  }
}
