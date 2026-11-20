/** Where the site's pages may load from and talk to. Every value is an address from the configuration; a missing one is left out. */
export type CspSources = {
  siteUrl: string;
  supabaseUrl: string;
  mediaUrl: string;
  gamesBaseUrl: string;
  uploadUrl: string;
  development: boolean;
};

const TURNSTILE = "https://challenges.cloudflare.com";
const OAUTH_PAGES = ["https://accounts.google.com", "https://discord.com"];

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function websocketOf(origin: string | null): string | null {
  return origin ? origin.replace(/^http/, "ws") : null;
}

/** Every game lives on its own subdomain of the games domain: `<public_id>.games.example`. */
function gamesSourceOf(gamesBaseUrl: string): string | null {
  try {
    const parsed = new URL(gamesBaseUrl);
    return `${parsed.protocol}//*.${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * The site's Content-Security-Policy. Scripts can only come from the site itself (inline ones included: Next writes the page's data
 * inline, and a nonce would make every page dynamic) and from the captcha; requests go only to Supabase, the upload bucket and
 * the captcha; frames only show games (from the games domain, which also keeps a game from sending its frame elsewhere) and the
 * captcha; forms only post here or start a sign-in; and nobody can frame the site, change its base address or load plugins.
 */
export function contentSecurityPolicy(sources: CspSources): string {
  const site = originOf(sources.siteUrl);
  const supabase = originOf(sources.supabaseUrl);
  const media = originOf(sources.mediaUrl);
  const upload = originOf(sources.uploadUrl);
  const games = gamesSourceOf(sources.gamesBaseUrl);
  const development = sources.development;

  const directives: [string, (string | null)[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", TURNSTILE, development ? "'unsafe-eval'" : null]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", media]],
    ["media-src", ["'self'", "blob:", media]],
    ["font-src", ["'self'", "data:"]],
    [
      "connect-src",
      ["'self'", supabase, websocketOf(supabase), upload, TURNSTILE, development ? websocketOf(site) : null, development ? "ws://127.0.0.1:3000" : null],
    ],
    ["frame-src", [games, TURNSTILE]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'", supabase, ...OAUTH_PAGES]],
    ["frame-ancestors", ["'none'"]],
  ];

  const policy = directives.map(([name, values]) => `${name} ${[...new Set(values.filter((value): value is string => !!value))].join(" ")}`);
  if (site?.startsWith("https://")) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
