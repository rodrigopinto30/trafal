import { describe, expect, it } from "vitest";
import { accountFilesSchema, deleteAccountSchemaFor } from "./account";

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
