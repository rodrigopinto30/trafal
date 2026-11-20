import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { PASSWORD_CHANGE_ERROR_KEYS, accountFilesSchema, changePasswordSchema, deleteAccountSchemaFor } from "./account";

const id = "a0000000-0000-0000-0000-000000000001";

describe("account deletion input", () => {
  it("needs the username, cleaned of stray spaces, and the proof that it is them", () => {
    const schema = deleteAccountSchemaFor("password");
    expect(schema.safeParse({ confirmation: "  ana  ", secret: " Secret 1 " })).toMatchObject({ success: true, data: { confirmation: "ana", secret: " Secret 1 " } });
    for (const confirmation of ["", "   ", null, undefined]) expect(schema.safeParse({ confirmation, secret: "x" }).success).toBe(false);
  });

  it("keeps the password exactly as typed and refuses an empty one or an absurdly long one", () => {
    const schema = deleteAccountSchemaFor("password");
    expect(schema.safeParse({ confirmation: "ana", secret: "" }).error?.issues[0]?.message).toBe("passwordRequired");
    expect(schema.safeParse({ confirmation: "ana", secret: "   " }).error?.issues[0]?.message).toBe("passwordRequired");
    expect(schema.safeParse({ confirmation: "ana", secret: null }).success).toBe(false);
    expect(schema.safeParse({ confirmation: "ana", secret: "x".repeat(1025) }).success).toBe(false);
  });

  it("asks for the email instead when the account has no password", () => {
    expect(deleteAccountSchemaFor("email").safeParse({ confirmation: "ana", secret: "" }).error?.issues[0]?.message).toBe("emailRequired");
  });
});

describe("changing the password", () => {
  const firstError = (input: Record<string, unknown>) => changePasswordSchema.safeParse(input).error?.issues[0];

  it("keeps both passwords exactly as typed", () => {
    expect(changePasswordSchema.parse({ current: " vieja 1 ", password: " Nueva123 ", confirm: " Nueva123 " })).toEqual({ current: " vieja 1 ", password: " Nueva123 ", confirm: " Nueva123 " });
  });

  it("asks for the current password, and does not take an absurdly long one", () => {
    expect(firstError({ current: "", password: "Nueva123", confirm: "Nueva123" })).toMatchObject({ message: "currentRequired", path: ["current"] });
    expect(firstError({ password: "Nueva123", confirm: "Nueva123" })).toMatchObject({ message: "currentRequired", path: ["current"] });
    expect(firstError({ current: "x".repeat(1025), password: "Nueva123", confirm: "Nueva123" })).toMatchObject({ path: ["current"] });
  });

  it("the new one follows the sign-up rules, is typed twice the same and is not the current one", () => {
    for (const password of ["corta1", "solamenteletras", "12345678", "a1".repeat(37)]) {
      expect(firstError({ current: "Vieja123", password, confirm: password }), password).toMatchObject({ message: "weakPassword", path: ["password"] });
    }
    expect(firstError({ current: "Vieja123", password: "Nueva123", confirm: "" })).toMatchObject({ message: "confirmRequired", path: ["confirm"] });
    expect(firstError({ current: "Vieja123", password: "Nueva123", confirm: "Nueva124" })).toMatchObject({ message: "passwordsDontMatch", path: ["confirm"] });
    expect(firstError({ current: "Vieja123", password: "Vieja123", confirm: "Vieja123" })).toMatchObject({ message: "samePassword", path: ["password"] });
  });

  it.each([
    ["es", es.settings.password],
    ["en", en.settings.password],
  ])("has a message for every error (%s), and none left over", (_language, messages) => {
    expect(Object.keys(messages.errors).sort()).toEqual([...PASSWORD_CHANGE_ERROR_KEYS].sort());
  });
});

describe("the folders the database lists", () => {
  it("accepts the folders of every bucket", () => {
    const rows = [
      { bucket: "media", prefix: `avatars/${id}/` },
      { bucket: "media", prefix: `posts/${id}/` },
      { bucket: "quarantine", prefix: `${id}/` },
      { bucket: "games", prefix: "k3x9a2/" },
    ];
    expect(accountFilesSchema.safeParse(rows).success).toBe(true);
  });

  it("refuses anything that could reach more than one folder", () => {
    for (const prefix of ["", "/", "../", "avatars/../", `avatars/${id}`, "a//b/", "*", "a b/", `${id}/../`, "/etc/"]) {
      expect(accountFilesSchema.safeParse([{ bucket: "media", prefix }]).success, prefix).toBe(false);
    }
    expect(accountFilesSchema.safeParse([{ bucket: "other", prefix: "a/" }]).success).toBe(false);
    expect(accountFilesSchema.safeParse("x").success).toBe(false);
    expect(accountFilesSchema.safeParse(null).success).toBe(false);
  });
});
