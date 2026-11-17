import { describe, expect, it } from "vitest";
import { oauthProviderSchema } from "@/lib/validation/auth";
import { enabledOAuthProviders } from "./oauth-providers";

describe("enabledOAuthProviders", () => {
  it("offers only the providers with credentials, Google first", () => {
    expect(enabledOAuthProviders({ googleEnabled: false, discordEnabled: false })).toEqual([]);
    expect(enabledOAuthProviders({ googleEnabled: true, discordEnabled: false })).toEqual(["google"]);
    expect(enabledOAuthProviders({ googleEnabled: false, discordEnabled: true })).toEqual(["discord"]);
    expect(enabledOAuthProviders({ googleEnabled: true, discordEnabled: true })).toEqual(["google", "discord"]);
  });
});

describe("oauthProviderSchema", () => {
  it("accepts the two providers and nothing else", () => {
    expect(oauthProviderSchema.safeParse("google").success).toBe(true);
    expect(oauthProviderSchema.safeParse("discord").success).toBe(true);
    for (const other of ["github", "Google", "", null, undefined, ["google"]]) expect(oauthProviderSchema.safeParse(other).success).toBe(false);
  });
});
