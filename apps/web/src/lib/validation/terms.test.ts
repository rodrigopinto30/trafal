import { describe, expect, it } from "vitest";
import { acceptTermsSchema } from "./terms";

describe("acceptTermsSchema", () => {
  it("needs the box checked", () => {
    expect(acceptTermsSchema.safeParse({ consent: true }).success).toBe(true);
    const unchecked = acceptTermsSchema.safeParse({ consent: false });
    expect(unchecked.success).toBe(false);
    expect(unchecked.error?.issues[0]?.message).toBe("consentRequired");
  });

  it("refuses anything that is not a boolean", () => {
    expect(acceptTermsSchema.safeParse({ consent: "on" }).success).toBe(false);
    expect(acceptTermsSchema.safeParse({}).success).toBe(false);
  });
});
