import { publicEnv } from "@/lib/env";
import type { OAuthProvider } from "@/lib/validation/auth";

type ProviderSwitches = { googleEnabled: boolean; discordEnabled: boolean };

/** The outside accounts people can sign in with here, in the order their buttons show: only those with credentials configured. */
export function enabledOAuthProviders(env: ProviderSwitches = publicEnv): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (env.googleEnabled) providers.push("google");
  if (env.discordEnabled) providers.push("discord");
  return providers;
}
