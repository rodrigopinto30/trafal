import { describe, expect, it } from "vitest";
import { emailMatches, reauthMethodOf } from "./reauth";

describe("reauthMethodOf", () => {
  it("asks for the password when the account has one", () => {
    expect(reauthMethodOf({ app_metadata: { providers: ["email"] } })).toBe("password");
    expect(reauthMethodOf({ app_metadata: { providers: ["google", "email"] } })).toBe("password");
  });

  it("asks for the email when the account only signs in with a provider, or nothing is known", () => {
    expect(reauthMethodOf({ app_metadata: { providers: ["google"] } })).toBe("email");
    expect(reauthMethodOf({ app_metadata: {} })).toBe("email");
    expect(reauthMethodOf({ app_metadata: null })).toBe("email");
    expect(reauthMethodOf({})).toBe("email");
    expect(reauthMethodOf({ app_metadata: { providers: "email" } })).toBe("email");
  });
});

describe("emailMatches", () => {
  it("ignores case and spaces", () => {
    expect(emailMatches("  Ana@Example.com ", "ana@example.com")).toBe(true);
  });

  it("refuses anything else, and an account without an email", () => {
    expect(emailMatches("bruno@example.com", "ana@example.com")).toBe(false);
    expect(emailMatches("", "ana@example.com")).toBe(false);
    expect(emailMatches("ana@example.com", null)).toBe(false);
    expect(emailMatches("", undefined)).toBe(false);
  });
});
