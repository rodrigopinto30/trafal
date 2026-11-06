export class ConfigError extends Error {}

export type GatewayConfig = {
  port: number;
  gamesDomain: string;
  siteOrigin: string;
  siteUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
  s3: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; bucket: string };
  deliveryCacheSeconds: number;
  cdnScriptSources: string[];
  cdnStyleSources: string[];
  cdnFontSources: string[];
};

type Env = Record<string, string | undefined>;

const REQUIRED = ["GAMES_BASE_URL", "SITE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];

const DEFAULT_CDN_SCRIPTS = "https://cdn.jsdelivr.net,https://cdnjs.cloudflare.com,https://unpkg.com";
const DEFAULT_CDN_STYLES = "https://fonts.googleapis.com,https://cdn.jsdelivr.net,https://cdnjs.cloudflare.com";
const DEFAULT_CDN_FONTS = "https://fonts.gstatic.com,https://cdn.jsdelivr.net,https://cdnjs.cloudflare.com";

function list(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

/**
 * Reads the gateway settings from the environment and fails with everything that is missing. GAMES_BASE_URL is the games
 * origin without the game id (http://games.localhost:4000): each game lives at <public_id>.<that host>.
 */
export function loadGatewayConfig(env: Env): GatewayConfig {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) throw new ConfigError(`Missing environment variables: ${missing.join(", ")}`);

  const gamesBase = new URL(env.GAMES_BASE_URL as string);
  const site = new URL(env.SITE_URL as string);
  return {
    port: Number(env.PORT ?? "4000"),
    gamesDomain: gamesBase.hostname.toLowerCase(),
    siteOrigin: site.origin,
    siteUrl: site.origin,
    supabaseUrl: (env.SUPABASE_URL as string).replace(/\/+$/, ""),
    supabaseKey: env.SUPABASE_PUBLISHABLE_KEY as string,
    s3: {
      endpoint: env.S3_ENDPOINT as string,
      region: env.S3_REGION || "auto",
      accessKeyId: env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
      bucket: env.S3_BUCKET_GAMES || "games",
    },
    deliveryCacheSeconds: Number(env.GATEWAY_DELIVERY_CACHE_SECONDS ?? "10"),
    cdnScriptSources: list(env.GATEWAY_CDN_SCRIPTS, DEFAULT_CDN_SCRIPTS),
    cdnStyleSources: list(env.GATEWAY_CDN_STYLES, DEFAULT_CDN_STYLES),
    cdnFontSources: list(env.GATEWAY_CDN_FONTS, DEFAULT_CDN_FONTS),
  };
}
