import { describe, expect, it } from "vitest";
import { accountFilesSchema, deleteAccountSchema } from "./account";

const id = "a0000000-0000-0000-0000-000000000001";

describe("account deletion input", () => {
  it("needs something typed, cleaned of stray spaces", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "  ana  " })).toMatchObject({ success: true, data: { confirmation: "ana" } });
    for (const confirmation of ["", "   ", null, undefined]) expect(deleteAccountSchema.safeParse({ confirmation }).success).toBe(false);
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
