import { describe, expect, it } from "vitest";
import { authErrorKey, onboardingErrorCode } from "./errors";

describe("authErrorKey", () => {
  it("traduce los códigos de Supabase Auth", () => {
    expect(authErrorKey({ code: "invalid_credentials" })).toBe("invalidCredentials");
    expect(authErrorKey({ code: "email_not_confirmed" })).toBe("emailNotConfirmed");
    expect(authErrorKey({ code: "weak_password" })).toBe("weakPassword");
    expect(authErrorKey({ code: "over_email_send_rate_limit" })).toBe("rateLimited");
    expect(authErrorKey({ code: "email_address_invalid" })).toBe("invalidEmail");
  });
  it("usa el status 429 como límite de intentos", () => {
    expect(authErrorKey({ status: 429 })).toBe("rateLimited");
  });
  it("cae en genérico ante lo desconocido", () => {
    expect(authErrorKey({ code: "algo_nuevo", status: 500 })).toBe("generic");
    expect(authErrorKey({})).toBe("generic");
  });
});

describe("onboardingErrorCode", () => {
  it("reconoce los códigos de complete_onboarding", () => {
    expect(onboardingErrorCode("username_taken")).toBe("username_taken");
    expect(onboardingErrorCode("age_confirmation_required")).toBe("age_confirmation_required");
  });
  it("no deja pasar textos arbitrarios", () => {
    expect(onboardingErrorCode("duplicate key value violates unique constraint")).toBe("generic");
    expect(onboardingErrorCode(null)).toBe("generic");
  });
});
