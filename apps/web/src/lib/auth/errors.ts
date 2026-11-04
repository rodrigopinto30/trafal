/** Claves del namespace «auth.errors» a las que se traducen los errores de Supabase Auth. */
export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "weakPassword"
  | "rateLimited"
  | "invalidEmail"
  | "generic";

export function authErrorKey(error: { code?: string | null; status?: number | null }): AuthErrorKey {
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "weak_password":
      return "weakPassword";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "rateLimited";
    case "email_address_invalid":
    case "validation_failed":
      return "invalidEmail";
    default:
      return error.status === 429 ? "rateLimited" : "generic";
  }
}

/** Códigos que lanza la función SQL complete_onboarding (mensaje de la excepción) → clave de «onboarding.errors». */
export const ONBOARDING_ERROR_CODES = [
  "username_taken",
  "invalid_username",
  "reserved_username",
  "invalid_display_name",
  "age_confirmation_required",
  "terms_required",
  "already_onboarded",
] as const;

export type OnboardingErrorCode = (typeof ONBOARDING_ERROR_CODES)[number];

export function onboardingErrorCode(message: string | null | undefined): OnboardingErrorCode | "generic" {
  return (ONBOARDING_ERROR_CODES as readonly string[]).includes(message ?? "")
    ? (message as OnboardingErrorCode)
    : "generic";
}
